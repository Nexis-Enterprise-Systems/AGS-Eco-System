-- Multi-entity / Business Units — Phase 2 (pre-auth branding
-- resolution, Invited Users unit scoping, handle_new_user() unit
-- assignment). See MULTI_ENTITY_SPEC.md for the full design; this
-- migration is the database half of Phase 2 — Phase 1
-- (0005_business_units.sql) must already have run.
--
-- Run this after 0005_business_units.sql, once per client project.

-- ---------------------------------------------------------------------
-- get_head_office_branding() — lets a visitor who hasn't signed in yet
-- (the Login and Signup pages) see the Head Office unit's branding
-- before authenticating. business_units' own RLS
-- (business_units_select_authenticated, from 0005) only allows
-- authenticated reads — correct once someone's signed in, but it
-- leaves nothing for the pre-auth login screen. Rather than widen the
-- table's RLS (which would expose every unit's contact/registration
-- details to an anonymous visitor), this SECURITY DEFINER function
-- returns just the handful of branding fields the login screen
-- actually needs, for the Head Office unit only. Mirrors
-- check_invite()'s pattern from 0003_self_signup.sql.
-- ---------------------------------------------------------------------
create or replace function public.get_head_office_branding()
returns table (
  company_name text,
  logo_url text,
  color_primary text,
  color_secondary text,
  color_accent text,
  color_surface text,
  color_surface_muted text,
  color_ink text,
  color_ink_muted text
)
language sql stable security definer set search_path = public
as $$
  select company_name, logo_url, color_primary, color_secondary, color_accent,
         color_surface, color_surface_muted, color_ink, color_ink_muted
  from public.business_units
  where is_head_office
  limit 1;
$$;

grant execute on function public.get_head_office_branding() to anon, authenticated;

-- ---------------------------------------------------------------------
-- handle_new_user() — replaces the version from 0003_self_signup.sql.
-- Adds exactly one thing: copies the accepted invite's
-- business_unit_id onto the new profile. Without this, every
-- self-signup landed with business_unit_id = null ("all units"
-- access) regardless of which unit they were actually invited into —
-- harmless for a single-entity client, but a real permissions bug the
-- moment a client has more than one business unit with its own local
-- admin.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  invite public.invited_users%rowtype;
begin
  select * into invite
  from public.invited_users
  where lower(email) = lower(new.email) and accepted_at is null
  limit 1;

  if not found then
    raise exception 'This email has not been invited. Ask your administrator to add it before you can create an account.';
  end if;

  insert into public.profiles (id, email, full_name, role, business_unit_id)
  values (new.id, new.email, coalesce(invite.full_name, ''), invite.role, invite.business_unit_id);

  if invite.role = 'subcontractor' then
    update public.sub_contractors
      set user_id = new.id
      where user_id is null and lower(email) = lower(new.email);
  end if;

  update public.invited_users
    set accepted_at = now()
    where id = invite.id;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- invited_users RLS — was admin-all-access with no unit scoping at
-- all (fine when every admin could see every invite, but not once a
-- unit can have its own local admin managing its own team). Same
-- pattern as clients/sub_contractors in 0005: a Head Office admin
-- (business_unit_id is null) manages every invite; a unit-scoped
-- admin manages only invites for their own unit. An invite with
-- business_unit_id = null (a Head-Office-level invite) stays visible
-- to Head Office admins only — that's deliberate, not a bug.
-- ---------------------------------------------------------------------
drop policy if exists "invited_users_admin_all" on public.invited_users;
create policy "invited_users_admin_all" on public.invited_users
  for all using (
    public.current_role() = 'admin' and public.mfa_ok()
    and (
      public.current_business_unit_id() is null
      or public.current_business_unit_id() = invited_users.business_unit_id
    )
  );
