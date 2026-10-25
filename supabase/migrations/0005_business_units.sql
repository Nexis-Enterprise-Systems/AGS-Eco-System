-- Multi-entity / Business Units — Phase 1 (schema + RLS + data
-- migration). See MULTI_ENTITY_SPEC.md at the repo root for the full
-- design and the still-to-build UI phases.
--
-- Adds business_units as a first-class table (one Head Office unit
-- plus any number of subsidiary units, each optionally its own legal
-- entity with its own registration/VAT number and optionally its own
-- branding), and scopes clients/sub_contractors/profiles/invited_users
-- to a unit. This is written to be SAFE to run against an
-- already-populated project (including Aaron's own demo project):
-- nothing is dropped, existing data is migrated into one Head Office
-- unit, and every existing login keeps exactly the access it already
-- had (business_unit_id on profiles is left null = "all units", so a
-- client that never adds a second unit sees no behavioural change).
--
-- Run this once per client project, after 0001/0002/0003/0004.

-- ---------------------------------------------------------------------
-- business_units
-- ---------------------------------------------------------------------
create table if not exists public.business_units (
  id uuid primary key default gen_random_uuid(),
  is_head_office boolean not null default false,
  company_name text not null default 'Client Company',
  trading_name text,
  contact_email text,
  contact_phone text,
  address text,
  region text not null default 'gb',
  business_registration_number text,
  vat_number text,
  -- Branding. When use_custom_branding is false, the app falls back to
  -- the Head Office unit's branding — a new unit never has to fill
  -- these in unless it deliberately wants its own look (see spec:
  -- "acquired subsidiary keeps its own identity" vs "looks like the
  -- parent").
  use_custom_branding boolean not null default false,
  logo_url text,
  color_primary text not null default '15 76 129',
  color_secondary text not null default '30 41 59',
  color_accent text not null default '217 119 6',
  color_surface text not null default '255 255 255',
  color_surface_muted text not null default '245 246 248',
  color_ink text not null default '17 24 39',
  color_ink_muted text not null default '100 116 139',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_units
  drop constraint if exists business_units_region_ck;
alter table public.business_units
  add constraint business_units_region_ck check (region in ('gb', 'ae', 'other'));

-- Exactly one Head Office unit, ever.
create unique index if not exists business_units_one_head_office_idx
  on public.business_units (is_head_office) where (is_head_office);

drop trigger if exists set_updated_at on public.business_units;
create trigger set_updated_at before update on public.business_units
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- Seed the Head Office unit from whatever's currently in the
-- system_settings singleton — preserves the exact company profile and
-- branding a client already has today. use_custom_branding = true so
-- it keeps its own colours/logo rather than falling back to... itself.
-- system_settings is left in place untouched (see spec, Phase 6) —
-- nothing reading it today breaks because of this migration.
-- ---------------------------------------------------------------------
insert into public.business_units (
  is_head_office, company_name, trading_name, contact_email, contact_phone, address, region,
  business_registration_number, vat_number, use_custom_branding, logo_url,
  color_primary, color_secondary, color_accent, color_surface, color_surface_muted, color_ink, color_ink_muted
)
select
  true, company_name, trading_name, contact_email, contact_phone, address, region,
  business_registration_number, vat_number, true, logo_url,
  color_primary, color_secondary, color_accent, color_surface, color_surface_muted, color_ink, color_ink_muted
from public.system_settings
where id = true
on conflict (is_head_office) where (is_head_office) do nothing;

-- ---------------------------------------------------------------------
-- Scope clients, sub_contractors, profiles and invited_users to a
-- business unit. clients/sub_contractors are backfilled to the new
-- Head Office unit then made not-null — every existing record has to
-- belong to a unit. profiles/invited_users stay nullable and are left
-- null (= all-unit access) — see migration header for why that's the
-- safe, no-behaviour-change default.
-- ---------------------------------------------------------------------
alter table public.clients add column if not exists business_unit_id uuid references public.business_units(id);
update public.clients set business_unit_id = (select id from public.business_units where is_head_office limit 1)
  where business_unit_id is null;
alter table public.clients alter column business_unit_id set not null;
create index if not exists clients_business_unit_idx on public.clients(business_unit_id);

alter table public.sub_contractors add column if not exists business_unit_id uuid references public.business_units(id);
update public.sub_contractors set business_unit_id = (select id from public.business_units where is_head_office limit 1)
  where business_unit_id is null;
alter table public.sub_contractors alter column business_unit_id set not null;
create index if not exists subcontractors_business_unit_idx on public.sub_contractors(business_unit_id);

alter table public.profiles add column if not exists business_unit_id uuid references public.business_units(id);
alter table public.invited_users add column if not exists business_unit_id uuid references public.business_units(id);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.business_units enable row level security;

-- Helper: current user's business unit, null = all units. Mirrors the
-- existing current_role() pattern (security definer, avoids recursive
-- RLS lookups on profiles).
create or replace function public.current_business_unit_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select business_unit_id from public.profiles where id = auth.uid();
$$;

-- business_units: any authenticated user can read every unit (branding
-- has to resolve before we know which unit someone belongs to). Only a
-- Head Office admin can create/delete units; a unit's own admin can
-- update only that one unit's row.
drop policy if exists "business_units_select_authenticated" on public.business_units;
create policy "business_units_select_authenticated" on public.business_units
  for select using (auth.role() = 'authenticated');

drop policy if exists "business_units_head_office_admin_all" on public.business_units;
create policy "business_units_head_office_admin_all" on public.business_units
  for all using (public.current_role() = 'admin' and public.current_business_unit_id() is null);

drop policy if exists "business_units_unit_admin_update_own" on public.business_units;
create policy "business_units_unit_admin_update_own" on public.business_units
  for update using (public.current_role() = 'admin' and public.current_business_unit_id() = business_units.id);

-- clients: staff/admin full access, scoped to their business unit
-- (null = all units). Replaces the 0001 policy of the same name.
drop policy if exists "clients_staff_all" on public.clients;
create policy "clients_staff_all" on public.clients
  for all using (
    public.is_staff()
    and (public.current_business_unit_id() is null or public.current_business_unit_id() = clients.business_unit_id)
  );

-- projects: no business_unit_id of its own (see spec) — scoped via its
-- client's unit. Replaces the 0001 policy of the same name.
drop policy if exists "projects_staff_all" on public.projects;
create policy "projects_staff_all" on public.projects
  for all using (
    public.is_staff()
    and (
      public.current_business_unit_id() is null
      or exists (
        select 1 from public.clients c
        where c.id = projects.client_id and c.business_unit_id = public.current_business_unit_id()
      )
    )
  );

-- sub_contractors: staff/admin full access, scoped to their business
-- unit. Replaces the 0001 policy of the same name.
drop policy if exists "subcontractors_staff_all" on public.sub_contractors;
create policy "subcontractors_staff_all" on public.sub_contractors
  for all using (
    public.is_staff()
    and (public.current_business_unit_id() is null or public.current_business_unit_id() = sub_contractors.business_unit_id)
  );

-- project_subcontractors: scoped via the project's client's unit.
-- Replaces the 0001 policy of the same name.
drop policy if exists "project_subcontractors_staff_all" on public.project_subcontractors;
create policy "project_subcontractors_staff_all" on public.project_subcontractors
  for all using (
    public.is_staff()
    and (
      public.current_business_unit_id() is null
      or exists (
        select 1 from public.projects p
        join public.clients c on c.id = p.client_id
        where p.id = project_subcontractors.project_id and c.business_unit_id = public.current_business_unit_id()
      )
    )
  );

-- audit_documents: scoped via the project's client's unit. Replaces
-- the 0001 policy of the same name.
drop policy if exists "audit_documents_staff_all" on public.audit_documents;
create policy "audit_documents_staff_all" on public.audit_documents
  for all using (
    public.is_staff()
    and (
      public.current_business_unit_id() is null
      or exists (
        select 1 from public.projects p
        join public.clients c on c.id = p.client_id
        where p.id = audit_documents.project_id and c.business_unit_id = public.current_business_unit_id()
      )
    )
  );
