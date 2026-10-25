-- Enforces two-factor authentication at the database level.
--
-- The React app's ProtectedRoute (src/components/ProtectedRoute.tsx)
-- already redirects any session without a completed 2FA challenge to
-- /mfa-setup or /mfa-challenge. That's a UX convenience only — on its
-- own it does NOT stop someone with valid credentials from bypassing
-- the app entirely and calling Supabase's API directly with a
-- password-only (aal1) session. This migration closes that gap: every
-- Row Level Security policy that touches client/project data now
-- requires the session to actually be at aal2 (i.e. the 2FA code
-- challenge has been completed), full stop, no exceptions.
--
-- Run this after 0001_init.sql, in the same Supabase SQL Editor, once
-- per client project.

-- ---------------------------------------------------------------------
-- mfa_ok() — true only once this session has completed its 2FA
-- challenge (aal2). Supabase puts the assurance level actually
-- reached by the current session in the JWT's "aal" claim, which is
-- what auth.jwt() reads here — checking supabase.auth.mfa.* client
-- state (as the app's UI does) would NOT be authoritative, since that
-- can't be enforced against a direct API call.
-- ---------------------------------------------------------------------
create or replace function public.mfa_ok()
returns boolean
language sql stable
as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false);
$$;

-- ---------------------------------------------------------------------
-- is_staff() now requires mfa_ok() too. Because nearly every
-- staff/admin policy in 0001_init.sql is written as
-- `using (public.is_staff())`, this one change cascades 2FA
-- enforcement across clients, projects, sub_contractors,
-- integrations, audit_documents, and the audit-documents storage
-- bucket without having to touch each policy individually.
-- ---------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean language sql stable as $$
  select public.current_role() in ('admin', 'staff') and public.mfa_ok();
$$;

-- ---------------------------------------------------------------------
-- The handful of policies that don't route through is_staff() need
-- mfa_ok() added directly. profiles_select_own_or_staff is
-- deliberately left UNCHANGED for the `id = auth.uid()` branch — a
-- session still owes 2FA needs to read its own profile row (just
-- name/email/role, nothing sensitive) so the app can render the
-- /mfa-setup or /mfa-challenge screen at all. Writing to your own
-- profile, and everything else below, requires aal2.
-- ---------------------------------------------------------------------
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid() and public.mfa_ok());

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all using (public.current_role() = 'admin' and public.mfa_ok());

-- system_settings: widened to be readable by anyone, signed in or
-- not (it's just company name/logo/colours, nothing sensitive), so
-- the login screen and the /mfa-setup and /mfa-challenge screens can
-- still show the client's own branding before 2FA is satisfied.
drop policy if exists "system_settings_select_authenticated" on public.system_settings;
create policy "system_settings_select_public" on public.system_settings
  for select using (true);

drop policy if exists "system_settings_admin_write" on public.system_settings;
create policy "system_settings_admin_write" on public.system_settings
  for update using (public.current_role() = 'admin' and public.mfa_ok());

-- Sub-contractor "read your own assignment" policies expose real
-- client/project data, so these need the same aal2 requirement as
-- everything staff touches.
drop policy if exists "clients_subcontractor_select" on public.clients;
create policy "clients_subcontractor_select" on public.clients
  for select using (
    public.mfa_ok()
    and exists (
      select 1 from public.projects p
      join public.project_subcontractors ps on ps.project_id = p.id
      join public.sub_contractors sc on sc.id = ps.sub_contractor_id
      where p.client_id = clients.id and sc.user_id = auth.uid()
    )
  );

drop policy if exists "projects_subcontractor_select" on public.projects;
create policy "projects_subcontractor_select" on public.projects
  for select using (
    public.mfa_ok()
    and exists (
      select 1 from public.project_subcontractors ps
      join public.sub_contractors sc on sc.id = ps.sub_contractor_id
      where ps.project_id = projects.id and sc.user_id = auth.uid()
    )
  );

drop policy if exists "subcontractors_select_own" on public.sub_contractors;
create policy "subcontractors_select_own" on public.sub_contractors
  for select using (user_id = auth.uid() and public.mfa_ok());

drop policy if exists "project_subcontractors_select_own" on public.project_subcontractors;
create policy "project_subcontractors_select_own" on public.project_subcontractors
  for select using (
    public.mfa_ok()
    and exists (
      select 1 from public.sub_contractors sc
      where sc.id = project_subcontractors.sub_contractor_id and sc.user_id = auth.uid()
    )
  );

-- Note on new users: an admin promoting a freshly-created account's
-- role from 'staff' to 'admin' in the Supabase Table Editor (README
-- step 3) is unaffected — the dashboard's table editor runs with
-- full service-role access and bypasses Row Level Security entirely,
-- so it isn't gated by mfa_ok(). Only access through the app/its
-- anon or authenticated API key is enforced by this migration.
