-- Interactive dashboard: each person's own chosen widgets, order and sizes.
-- One row per user. The layout is a small JSON list, e.g.
--   [{"id":"recent_projects","size":2},{"id":"stat_clients","size":1}]
-- Which widgets a role is ALLOWED to show is decided in the app
-- (src/dashboard/registry.tsx); this table only remembers what a person
-- picked. Same aal2 (verified 2FA) rule as every other table.
--
-- Run after 0008_ags_branding.sql.

create table if not exists public.dashboard_layouts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  layout jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.dashboard_layouts enable row level security;

drop policy if exists "dashboard_layouts_select_own" on public.dashboard_layouts;
create policy "dashboard_layouts_select_own" on public.dashboard_layouts
  for select using (user_id = auth.uid() and public.mfa_ok());

drop policy if exists "dashboard_layouts_insert_own" on public.dashboard_layouts;
create policy "dashboard_layouts_insert_own" on public.dashboard_layouts
  for insert with check (user_id = auth.uid() and public.mfa_ok());

drop policy if exists "dashboard_layouts_update_own" on public.dashboard_layouts;
create policy "dashboard_layouts_update_own" on public.dashboard_layouts
  for update using (user_id = auth.uid() and public.mfa_ok())
  with check (user_id = auth.uid() and public.mfa_ok());

drop policy if exists "dashboard_layouts_delete_own" on public.dashboard_layouts;
create policy "dashboard_layouts_delete_own" on public.dashboard_layouts
  for delete using (user_id = auth.uid() and public.mfa_ok());
