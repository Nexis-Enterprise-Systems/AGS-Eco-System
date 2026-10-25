-- Self-service account creation.
--
-- Before this migration, every user had to be created one at a time
-- by an admin in Supabase's Authentication -> Users screen. That's
-- fine for a handful of accounts but doesn't scale to onboarding a
-- whole client team at once. This migration adds an allowlist
-- (invited_users) an admin can bulk-populate (Invited Users page ->
-- Import CSV/Excel, same pattern as Clients/Projects/Sub-Contractors),
-- plus a public /signup page where anyone can create their own
-- account and choose their own password — but ONLY for an email
-- that's already on the allowlist.
--
-- Same philosophy as mandatory 2FA (0002_mandatory_mfa.sql): the app's
-- /signup page is a UX convenience, not the real enforcement. The
-- actual gate is inside handle_new_user() below, which runs for every
-- new auth.users row regardless of how it was created (the public
-- signup page, or an admin using Authentication -> Users directly) —
-- so it can't be bypassed by going around the app.
--
-- Run this after 0001_init.sql and 0002_mandatory_mfa.sql, in the same
-- SQL Editor, once per client project.

-- ---------------------------------------------------------------------
-- invited_users — the self-signup allowlist.
--
-- role is only ever set to 'staff' or 'subcontractor' by the app's UI
-- (Invited Users page) — self-service signup must never be able to
-- grant 'admin'. There's no database constraint enforcing that (a
-- genuine admin invite is still a legitimate thing to want later), so
-- if you ever need to invite a new admin, insert that row yourself in
-- the SQL Editor with role = 'admin' rather than through the app.
-- ---------------------------------------------------------------------
create table if not exists public.invited_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null default '',
  role user_role not null default 'staff',
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint invited_users_email_lower_ck check (email = lower(email)),
  constraint invited_users_email_unique unique (email)
);

create index if not exists invited_users_accepted_idx on public.invited_users(accepted_at);

alter table public.invited_users enable row level security;

-- Admin-only, end to end — mirrors profiles_admin_all /
-- system_settings_admin_write in 0002_mandatory_mfa.sql. Deciding who
-- can create an account and what role they land with is sensitive
-- enough that staff shouldn't manage it, only admin, and only with
-- 2FA satisfied this session (mfa_ok()).
create policy "invited_users_admin_all" on public.invited_users
  for all using (public.current_role() = 'admin' and public.mfa_ok());

-- ---------------------------------------------------------------------
-- check_invite(email) — lets the public /signup page ask "is this
-- email recognized?" before the user sets a password, without
-- exposing the rest of the invited_users table to an anonymous
-- visitor. SECURITY DEFINER so it can read invited_users despite the
-- admin-only RLS policy above; it only ever returns data for the one
-- email passed in.
-- ---------------------------------------------------------------------
create or replace function public.check_invite(p_email text)
returns table (full_name text)
language sql
security definer set search_path = public
as $$
  select full_name from public.invited_users
  where lower(email) = lower(p_email) and accepted_at is null
  limit 1;
$$;

grant execute on function public.check_invite(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- handle_new_user() — replaces the version from 0001_init.sql. Now
-- refuses to create a profile (and, because it's an AFTER INSERT
-- trigger raising an exception, refuses the whole auth.users insert
-- too — Postgres rolls back the entire transaction, so no "ghost"
-- unconfirmed user is left behind) unless the email matches an
-- unaccepted invited_users row.
--
-- IMPORTANT: this applies to every new account, including the very
-- first admin. Before creating your own first user in Authentication
-- -> Users (or having anyone sign up via /signup), insert a row for
-- that email yourself:
--   insert into public.invited_users (email, full_name, role)
--   values ('you@yourcompany.com', 'Your Name', 'admin');
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

  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(invite.full_name, ''), invite.role);

  -- If this invite is for a sub-contractor who already has a roster
  -- entry (added via Sub-Contractors -> + Add / Import, before they'd
  -- ever signed in), link that record to the new login now so their
  -- existing project assignments apply immediately.
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

-- Trigger itself is unchanged (still on_auth_user_created on
-- auth.users) — create or replace function above is enough since it's
-- the same function name the existing trigger already points at.
