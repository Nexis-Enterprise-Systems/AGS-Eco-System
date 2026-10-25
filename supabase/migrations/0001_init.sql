-- NEXIS Enterprise Systems — standalone client platform
-- Initial schema. Run once against THIS CLIENT'S OWN Supabase project
-- (Supabase Dashboard -> SQL Editor -> paste this file -> Run, or via
-- `supabase db push` if you're using the Supabase CLI).
--
-- Design notes:
--   * One Supabase project per client. This schema is not multi-tenant
--     on purpose — a client who buys the system outright (System
--     Buyout) gets a genuinely standalone project, nothing shared.
--   * `profiles` extends Supabase's built-in `auth.users` with the role
--     that drives both the sidebar nav and Row Level Security below.
--   * `system_settings` is a singleton table (always exactly one row)
--     holding company profile + branding colours, so the UI can theme
--     itself per client without a redeploy.
--   * Sub-contractors get their own login (a normal `auth.users` /
--     `profiles` row with role = 'subcontractor') and are scoped to
--     only the clients/projects they're assigned to via
--     `project_subcontractors`.

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- profiles — one row per auth.users row
-- ---------------------------------------------------------------------
create type user_role as enum ('admin', 'staff', 'subcontractor');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role user_role not null default 'staff',
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
-- New users default to 'staff'; promote to 'admin' manually in the
-- table editor for the first account, or via an admin-only UI action.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------
-- system_settings — singleton: company profile + branding
-- ---------------------------------------------------------------------
create table if not exists public.system_settings (
  id boolean primary key default true,
  company_name text not null default 'Client Company',
  logo_url text,
  color_primary text not null default '15 76 129',   -- "R G B" space-separated, matches Tailwind rgb()/<alpha-value> pattern
  color_secondary text not null default '30 41 59',
  color_accent text not null default '217 119 6',
  color_surface text not null default '255 255 255',
  color_surface_muted text not null default '245 246 248',
  color_ink text not null default '17 24 39',
  color_ink_muted text not null default '100 116 139',
  contact_email text,
  contact_phone text,
  timezone text not null default 'Asia/Dubai',
  updated_at timestamptz not null default now(),
  constraint system_settings_singleton check (id)
);

insert into public.system_settings (id) values (true)
  on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- integrations — pluggable connections, System Settings > Integrations
-- ---------------------------------------------------------------------
create type integration_category as enum ('accounting', 'email', 'payroll', 'banking');
create type integration_status as enum ('not_connected', 'connected', 'error');

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null,              -- e.g. 'xero', 'quickbooks', 'zoho_books', 'google', 'microsoft', 'wps', 'bank_file_export'
  category integration_category not null,
  -- Whether this provider is a real live API integration, or a
  -- file-generation-only capability (e.g. UAE WPS has no public API —
  -- it produces a SIF file for upload to a bank/exchange-house portal;
  -- UAE Open Banking is not yet production-ready for third-party
  -- access). The System Settings UI must label these honestly rather
  -- than presenting them as live connections.
  integration_type text not null default 'api' check (integration_type in ('api', 'file_export')),
  status integration_status not null default 'not_connected',
  config jsonb not null default '{}'::jsonb,  -- non-secret config only; tokens live in Supabase Vault / edge function secrets, never here
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider)
);

-- ---------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------
create type client_status as enum ('prospect', 'active', 'paused', 'archived');

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trading_name text,
  contact_name text,
  contact_email text,
  contact_phone text,
  address text,
  status client_status not null default 'active',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_status_idx on public.clients(status);

-- ---------------------------------------------------------------------
-- projects — belongs to a client
-- ---------------------------------------------------------------------
create type project_stage as enum (
  'discovery', 'audit', 'proposal', 'agreement', 'build', 'rollout', 'retainer', 'complete', 'on_hold'
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  description text,
  stage project_stage not null default 'discovery',
  start_date date,
  target_end_date date,
  build_fee numeric(12,2),
  monthly_retainer numeric(12,2),
  currency text not null default 'AED',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_client_idx on public.projects(client_id);
create index if not exists projects_stage_idx on public.projects(stage);

-- ---------------------------------------------------------------------
-- sub_contractors
-- ---------------------------------------------------------------------
create table if not exists public.sub_contractors (
  id uuid primary key default gen_random_uuid(),
  -- Linked once the sub-contractor has an actual login (profiles row
  -- with role = 'subcontractor'). Null until they're invited/signed up.
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text,
  phone text,
  specialty text,       -- e.g. "Backend / Supabase", "UI/UX", "QA"
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Join table: which sub-contractor is assigned to which project, and
-- what they can do there. This is what scopes a sub-contractor's
-- access to only their assigned clients/projects in RLS below.
create table if not exists public.project_subcontractors (
  project_id uuid not null references public.projects(id) on delete cascade,
  sub_contractor_id uuid not null references public.sub_contractors(id) on delete cascade,
  role_on_project text,   -- free text, e.g. "Lead developer", "QA"
  assigned_at timestamptz not null default now(),
  primary key (project_id, sub_contractor_id)
);

-- ---------------------------------------------------------------------
-- audit_documents — durable per-project reference material
-- (the audit export, findings doc, commercial proposal, engagement
-- agreement, etc. that led to this project, kept as reference while
-- building — not a client-facing panel)
-- ---------------------------------------------------------------------
create table if not exists public.audit_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_name text not null,
  storage_path text not null,     -- path within the 'audit-documents' Storage bucket
  doc_type text default 'other' check (doc_type in ('audit_export', 'findings', 'proposal', 'agreement', 'other')),
  notes text,
  uploaded_by uuid references public.profiles(id),
  uploaded_at timestamptz not null default now()
);

create index if not exists audit_documents_project_idx on public.audit_documents(project_id);

-- ---------------------------------------------------------------------
-- updated_at helper trigger
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.clients;
create trigger set_updated_at before update on public.clients
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.projects;
create trigger set_updated_at before update on public.projects
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.sub_contractors;
create trigger set_updated_at before update on public.sub_contractors
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.system_settings;
create trigger set_updated_at before update on public.system_settings
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.system_settings enable row level security;
alter table public.integrations enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.sub_contractors enable row level security;
alter table public.project_subcontractors enable row level security;
alter table public.audit_documents enable row level security;

-- Helper: current user's role, without recursive RLS lookups.
create or replace function public.current_role()
returns user_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean language sql stable as $$
  select public.current_role() in ('admin', 'staff');
$$;

-- profiles: everyone can read their own row; staff/admin can read all.
create policy "profiles_select_own_or_staff" on public.profiles
  for select using (id = auth.uid() or public.is_staff());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());
create policy "profiles_admin_all" on public.profiles
  for all using (public.current_role() = 'admin');

-- system_settings: any authenticated user can read (needed for
-- theming/login-screen branding); only admin can write.
create policy "system_settings_select_authenticated" on public.system_settings
  for select using (auth.role() = 'authenticated');
create policy "system_settings_admin_write" on public.system_settings
  for update using (public.current_role() = 'admin');

-- integrations: staff/admin only, end to end.
create policy "integrations_staff_all" on public.integrations
  for all using (public.is_staff());

-- clients: staff/admin full access. Sub-contractors can read only
-- clients tied to a project they're assigned to.
create policy "clients_staff_all" on public.clients
  for all using (public.is_staff());
create policy "clients_subcontractor_select" on public.clients
  for select using (
    exists (
      select 1 from public.projects p
      join public.project_subcontractors ps on ps.project_id = p.id
      join public.sub_contractors sc on sc.id = ps.sub_contractor_id
      where p.client_id = clients.id and sc.user_id = auth.uid()
    )
  );

-- projects: staff/admin full access. Sub-contractors can read only
-- their assigned projects.
create policy "projects_staff_all" on public.projects
  for all using (public.is_staff());
create policy "projects_subcontractor_select" on public.projects
  for select using (
    exists (
      select 1 from public.project_subcontractors ps
      join public.sub_contractors sc on sc.id = ps.sub_contractor_id
      where ps.project_id = projects.id and sc.user_id = auth.uid()
    )
  );

-- sub_contractors: staff/admin full access. A sub-contractor can read
-- their own record.
create policy "subcontractors_staff_all" on public.sub_contractors
  for all using (public.is_staff());
create policy "subcontractors_select_own" on public.sub_contractors
  for select using (user_id = auth.uid());

-- project_subcontractors: staff/admin full access. Sub-contractor can
-- read their own assignment rows.
create policy "project_subcontractors_staff_all" on public.project_subcontractors
  for all using (public.is_staff());
create policy "project_subcontractors_select_own" on public.project_subcontractors
  for select using (
    exists (
      select 1 from public.sub_contractors sc
      where sc.id = project_subcontractors.sub_contractor_id and sc.user_id = auth.uid()
    )
  );

-- audit_documents: staff/admin only. These are internal build
-- reference material, not shared with sub-contractors or clients.
create policy "audit_documents_staff_all" on public.audit_documents
  for all using (public.is_staff());

-- ---------------------------------------------------------------------
-- Storage bucket for audit reference documents (private)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('audit-documents', 'audit-documents', false)
  on conflict (id) do nothing;

create policy "audit_documents_bucket_staff_read" on storage.objects
  for select using (bucket_id = 'audit-documents' and public.is_staff());
create policy "audit_documents_bucket_staff_write" on storage.objects
  for insert with check (bucket_id = 'audit-documents' and public.is_staff());
create policy "audit_documents_bucket_staff_delete" on storage.objects
  for delete using (bucket_id = 'audit-documents' and public.is_staff());

-- Public bucket for company logo / branding assets (read-only to
-- everyone so it can be shown on the login screen before auth).
insert into storage.buckets (id, name, public)
  values ('branding', 'branding', true)
  on conflict (id) do nothing;

create policy "branding_bucket_public_read" on storage.objects
  for select using (bucket_id = 'branding');
create policy "branding_bucket_staff_write" on storage.objects
  for insert with check (bucket_id = 'branding' and public.is_staff());
create policy "branding_bucket_staff_update" on storage.objects
  for update using (bucket_id = 'branding' and public.is_staff());
