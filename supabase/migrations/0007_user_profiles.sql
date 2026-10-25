-- Personal profile fields, a per-business-unit "allow photo uploads"
-- toggle, and a masked cross-unit "team directory" — so people can see
-- who they're talking to (name/photo/role/unit) even across business
-- units, without opening up every profile's full row to everyone.
--
-- Context: profiles.phone and profiles.avatar_url already existed
-- (0001_init.sql) but nothing in the UI read or wrote them yet. This
-- migration adds date_of_birth, adds a per-person show_contact_details
-- flag an admin controls (off by default — a client wanted this
-- scoped by role/seniority rather than blanket-on for everyone), and
-- ships the storage bucket + function the new Profile/Team pages need.
--
-- Run this after 0006_business_units_phase2.sql.

alter table public.profiles
  add column if not exists date_of_birth date,
  add column if not exists show_contact_details boolean not null default false;

comment on column public.profiles.show_contact_details is
  'When true, this person''s email and phone appear in the team directory (get_team_directory) to every signed-in user, not just admin/staff. Off by default -- an admin turns it on per person (e.g. a role that genuinely needs to be reachable).';

alter table public.business_units
  add column if not exists allow_profile_photos boolean not null default true;

comment on column public.business_units.allow_profile_photos is
  'Per-unit toggle for whether this unit''s people can upload a profile photo. On by default; a unit''s own admin (or Head Office) can switch it off.';

-- ---------------------------------------------------------------------
-- Storage bucket for user-uploaded avatars
-- ---------------------------------------------------------------------
-- Public read (same pattern as the existing 'branding' bucket for
-- company logos) so a photo displays anywhere in the app without a
-- signed URL. Write access is locked to the uploader's own file: the
-- object name must start with "<their user id>-", enforced here, not
-- just by convention, so one account can never overwrite another's
-- photo even if they guess a path.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_bucket_public_read" on storage.objects;
create policy "avatars_bucket_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_bucket_own_write" on storage.objects;
create policy "avatars_bucket_own_write" on storage.objects
  for insert with check (bucket_id = 'avatars' and name like auth.uid()::text || '-%');

drop policy if exists "avatars_bucket_own_update" on storage.objects;
create policy "avatars_bucket_own_update" on storage.objects
  for update using (bucket_id = 'avatars' and name like auth.uid()::text || '-%');

drop policy if exists "avatars_bucket_own_delete" on storage.objects;
create policy "avatars_bucket_own_delete" on storage.objects
  for delete using (bucket_id = 'avatars' and name like auth.uid()::text || '-%');

-- ---------------------------------------------------------------------
-- get_team_directory() — masked, cross-unit "who's who"
-- ---------------------------------------------------------------------
-- Every signed-in user (including a sub-contractor, who today can't
-- read any other profile at all — see profiles_select_own_or_staff in
-- 0001_init.sql) can see a colleague's name/photo/role/unit; email and
-- phone are included only when that person's own show_contact_details
-- flag is on. This is additive — the existing profiles RLS policies
-- are untouched, so admin/staff keep the full access they already
-- have to the raw profiles table. SECURITY DEFINER so it can read
-- every row regardless of the caller's own RLS visibility — same
-- pattern as get_head_office_branding() in 0006.
create or replace function public.get_team_directory()
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  role user_role,
  business_unit_id uuid,
  email text,
  phone text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    p.avatar_url,
    p.role,
    p.business_unit_id,
    case when p.show_contact_details then p.email else null end as email,
    case when p.show_contact_details then p.phone else null end as phone
  from public.profiles p
  order by p.full_name;
$$;

-- Authenticated only — never anon. A directory of every user's name
-- and photo is not something to expose pre-login.
revoke all on function public.get_team_directory() from public;
grant execute on function public.get_team_directory() to authenticated;
