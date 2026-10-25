-- 0011: People onboarding (employees and sub-contractors, one process).
-- See docs/ONBOARDING_DESIGN.md. Run after 0010.
--
-- Office adds a person -> one-time link (7 days) -> person completes a
-- six-step form with NO login via the three public functions below
-- (onboarding_get / onboarding_save / onboarding_sign), each of which
-- checks the token on every call -> office Accepts or Rejects
-- (onboarding_review) -> accepted people are put on the invited_users
-- list so they can create their login with /signup.
--
-- Sensitive data (NI, UTR, bank, health) lives in separate tables that
-- only an admin with a 2FA session can read. Uploaded files go in a
-- private bucket. Nothing here is readable by anon except through the
-- token-checked functions.

-- Sub-contractor agreement templates need their own type.
alter table public.contract_templates drop constraint if exists contract_templates_employee_type_check;
alter table public.contract_templates add constraint contract_templates_employee_type_check
  check (employee_type in ('director','permanent','part_time','fixed_term','apprentice','casual','subcontractor'));

create sequence if not exists public.subcontractor_agreement_seq;

-- ---------------------------------------------------------------- tables
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  person_type text not null check (person_type in ('employee','subcontractor')),
  full_name text not null,
  email text not null,
  phone text not null default '',
  status text not null default 'pending' check (status in ('pending','active','rejected','archived')),
  job_role_id uuid references public.job_roles(id) on delete set null,
  job_title text not null default '',
  start_date date,
  rate numeric(12,2),
  rate_unit text check (rate_unit in ('year','day','hour','job')),
  engagement_type text check (engagement_type in ('individual','limited_company')),
  notes text not null default '',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists people_type_idx on public.people(person_type, status);
create index if not exists people_email_idx on public.people(lower(email));

create table if not exists public.onboardings (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  status text not null default 'invited'
    check (status in ('invited','in_progress','signed','accepted','rejected','expired')),
  token_hash text unique,
  token_expires_at timestamptz,
  template_id uuid references public.contract_templates(id) on delete set null,
  merge jsonb not null default '{}'::jsonb,
  draft jsonb not null default '{}'::jsonb,
  step integer not null default 1,
  invited_at timestamptz not null default now(),
  invited_by uuid references public.profiles(id) on delete set null,
  signed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reject_reason text,
  created_at timestamptz not null default now()
);
create index if not exists onboardings_person_idx on public.onboardings(person_id);

create table if not exists public.person_private (
  person_id uuid primary key references public.people(id) on delete cascade,
  date_of_birth date,
  address text not null default '',
  postcode text not null default '',
  ni_number text not null default '',
  utr text not null default '',
  bank_name text not null default '',
  account_number text not null default '',
  sort_code text not null default '',
  company_name text not null default '',
  company_number text not null default '',
  starter_statement text not null default '',
  student_loan boolean not null default false,
  emergency_name text not null default '',
  emergency_phone text not null default '',
  emergency_relationship text not null default '',
  updated_at timestamptz not null default now()
);

-- Address in the house layout: line 1, line 2, town/city, postcode, county.
-- `address` holds the same five lines as text for display and agreements.
alter table public.person_private add column if not exists address_line1 text not null default '';
alter table public.person_private add column if not exists address_line2 text not null default '';
alter table public.person_private add column if not exists town text not null default '';
alter table public.person_private add column if not exists county text not null default '';

-- Special category data (UK GDPR): its own table, admin-only.
create table if not exists public.person_health (
  person_id uuid primary key references public.people(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.person_certificates (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  kind text not null,
  number text not null default '',
  expiry_date date,
  file_path text,
  source text not null default 'onboarding',
  created_at timestamptz not null default now()
);
create index if not exists person_certs_person_idx on public.person_certificates(person_id);
create index if not exists person_certs_expiry_idx on public.person_certificates(expiry_date);

-- Append-only: signed wording is never updated or deleted by the app.
create table if not exists public.signed_agreements (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  onboarding_id uuid references public.onboardings(id) on delete set null,
  template_id uuid,
  template_name text not null default '',
  template_version integer,
  body_text text not null,
  signature_name text not null,
  signed_at timestamptz not null default now()
);
-- Stored PDF copy of the signed agreement (path in the onboarding-docs bucket).
alter table public.signed_agreements add column if not exists pdf_path text;

-- ------------------------------------------------------------------ RLS
do $$
declare t text;
begin
  foreach t in array array['people','onboardings','person_private','person_health','person_certificates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format(
      'create policy %I on public.%I for all using (public.current_role() = ''admin'' and public.mfa_ok()) with check (public.current_role() = ''admin'' and public.mfa_ok())',
      t || '_admin', t);
  end loop;
end $$;

alter table public.signed_agreements enable row level security;
drop policy if exists signed_agreements_admin_read on public.signed_agreements;
create policy signed_agreements_admin_read on public.signed_agreements
  for select using (public.current_role() = 'admin' and public.mfa_ok());

-- -------------------------------------------------------------- helpers
create or replace function public.hash_token(t text) returns text
language sql immutable as $$ select encode(sha256(convert_to(t, 'utf8')), 'hex') $$;

create or replace function public.assert_admin() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.current_role() = 'admin' and public.mfa_ok()) then
    raise exception 'Admin with a verified 2FA session required';
  end if;
end $$;

create or replace function public.onboarding_render(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare o public.onboardings; t public.contract_templates; body text; k text; v text; vals jsonb; addr text;
begin
  select * into o from public.onboardings where id = p_id;
  if o.id is null or o.template_id is null then return null; end if;
  select * into t from public.contract_templates where id = o.template_id;
  if t.id is null then return null; end if;
  body := t.body_md;
  addr := concat_ws(', ', nullif(o.draft->'personal'->>'address_line1', ''), nullif(o.draft->'personal'->>'address_line2', ''),
    nullif(o.draft->'personal'->>'town', ''), nullif(o.draft->'personal'->>'postcode', ''), nullif(o.draft->'personal'->>'county', ''));
  vals := coalesce(o.merge, '{}'::jsonb) || jsonb_build_object(
    'person_address', addr, 'director_address', addr, 'employee_address', addr, 'contractor_address', addr,
    'subcontractor_address', addr,
    'commencement_date', to_char(current_date, 'FMDD FMMonth YYYY'),
    'expected_completion_date', to_char(current_date + 365, 'FMDD FMMonth YYYY'));
  for k, v in select key, value from jsonb_each_text(vals) loop
    if coalesce(v, '') <> '' then body := replace(body, '{{' || k || '}}', v); end if;
  end loop;
  return body;
end $$;

create or replace function public.onboarding_upload_ok(folder text) returns boolean
language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.onboardings
    where id::text = folder and status in ('invited','in_progress') and token_expires_at > now()
  )
$$;

-- ------------------------------------------------- admin-side functions
create or replace function public.onboarding_create(
  p_type text, p_full_name text, p_email text, p_phone text, p_job_role_id uuid, p_job_title text,
  p_start_date date, p_rate numeric, p_rate_unit text, p_engagement_type text, p_template_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.job_roles; v_title text; v_person uuid; v_onb uuid; v_token text; v_merge jsonb; fmt_date text; rate_txt text; v_agr text;
begin
  perform public.assert_admin();
  if p_type not in ('employee','subcontractor') then raise exception 'Unknown person type'; end if;
  if coalesce(trim(p_full_name), '') = '' or coalesce(trim(p_email), '') = '' then raise exception 'Name and email are required'; end if;
  if p_job_role_id is not null then select * into r from public.job_roles where id = p_job_role_id; end if;
  v_title := coalesce(nullif(trim(p_job_title), ''), r.title, '');
  insert into public.people (person_type, full_name, email, phone, job_role_id, job_title, start_date, rate, rate_unit, engagement_type, created_by)
  values (p_type, trim(p_full_name), lower(trim(p_email)), coalesce(p_phone, ''), p_job_role_id, v_title, p_start_date,
          p_rate, p_rate_unit, p_engagement_type, auth.uid())
  returning id into v_person;
  if p_type = 'subcontractor' then
    v_agr := 'AGS-SC-' || lpad(nextval('public.subcontractor_agreement_seq')::text, 4, '0');
  end if;
  fmt_date := case when p_start_date is null then null else to_char(p_start_date, 'FMDD FMMonth YYYY') end;
  rate_txt := case when p_rate is null then null else '£' || to_char(p_rate, 'FM999,999,990.00') end;
  v_merge := jsonb_build_object(
    'director_full_name', trim(p_full_name), 'employee_full_name', trim(p_full_name),
    'contractor_full_name', trim(p_full_name), 'subcontractor_full_name', trim(p_full_name),
    'person_full_name', trim(p_full_name), 'agreement_number', v_agr,
    'job_title', v_title, 'start_date', fmt_date, 'continuous_service_date', fmt_date,
    'agreement_date', to_char(current_date, 'FMDD FMMonth YYYY'),
    'reports_to', r.reports_to, 'place_of_work', r.place_of_work, 'normal_hours', r.typical_hours,
    'job_summary', r.summary, 'job_duties', r.duties,
    'agreed_rate', case when rate_txt is null then null else rate_txt || ' per ' || coalesce(p_rate_unit, 'day') end,
    'annual_salary', case when p_rate_unit = 'year' then rate_txt else null end);
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.onboardings (person_id, status, token_hash, token_expires_at, template_id, merge, invited_by)
  values (v_person, 'invited', public.hash_token(v_token), now() + interval '7 days', p_template_id, v_merge, auth.uid())
  returning id into v_onb;
  return jsonb_build_object('person_id', v_person, 'onboarding_id', v_onb, 'token', v_token);
end $$;

-- New link for an existing onboarding (resend, expired link, or retry after a rejection).
create or replace function public.onboarding_reissue(p_onboarding_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare o public.onboardings; v_token text;
begin
  perform public.assert_admin();
  select * into o from public.onboardings where id = p_onboarding_id;
  if o.id is null then raise exception 'Onboarding not found'; end if;
  if o.status in ('signed','accepted') then raise exception 'Already signed; nothing to resend'; end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  update public.onboardings
    set token_hash = public.hash_token(v_token), token_expires_at = now() + interval '7 days',
        status = case when status = 'in_progress' then 'in_progress' else 'invited' end,
        reject_reason = null
    where id = p_onboarding_id;
  update public.people set status = 'pending', updated_at = now() where id = o.person_id and status = 'rejected';
  return v_token;
end $$;

create or replace function public.onboarding_review(p_onboarding_id uuid, p_accept boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare o public.onboardings; p public.people;
begin
  perform public.assert_admin();
  select * into o from public.onboardings where id = p_onboarding_id;
  if o.id is null then raise exception 'Onboarding not found'; end if;
  if o.status <> 'signed' then raise exception 'Only a signed onboarding can be reviewed'; end if;
  select * into p from public.people where id = o.person_id;
  if p_accept then
    update public.onboardings set status = 'accepted', reviewed_at = now(), reviewed_by = auth.uid() where id = o.id;
    update public.people set status = 'active', accepted_at = now(), accepted_by = auth.uid(), updated_at = now() where id = p.id;
    insert into public.invited_users (email, full_name, role, invited_by)
    values (lower(p.email), p.full_name,
            case when p.person_type = 'employee' then 'staff'::user_role else 'subcontractor'::user_role end, auth.uid())
    on conflict (email) do nothing;
  else
    if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required to reject'; end if;
    update public.onboardings set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(), reject_reason = trim(p_reason) where id = o.id;
    update public.people set status = 'rejected', updated_at = now() where id = p.id;
  end if;
end $$;

-- ------------------------------------- public (token-checked) functions
create or replace function public.onboarding_get(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.onboardings; p public.people; t public.contract_templates;
begin
  select * into o from public.onboardings where token_hash = public.hash_token(p_token);
  if o.id is null then return jsonb_build_object('error', 'invalid'); end if;
  if o.status not in ('invited','in_progress','expired') then return jsonb_build_object('error', 'invalid'); end if;
  if o.token_expires_at < now() then
    update public.onboardings set status = 'expired' where id = o.id;
    return jsonb_build_object('error', 'expired');
  end if;
  select * into p from public.people where id = o.person_id;
  if o.template_id is not null then select * into t from public.contract_templates where id = o.template_id; end if;
  return jsonb_build_object(
    'onboarding_id', o.id, 'person_type', p.person_type, 'full_name', p.full_name, 'email', p.email,
    'phone', p.phone, 'job_title', p.job_title, 'engagement_type', p.engagement_type,
    'draft', o.draft, 'step', o.step, 'agreement', public.onboarding_render(o.id),
    'agreement_name', t.name, 'expires_at', o.token_expires_at);
end $$;

create or replace function public.onboarding_save(p_token text, p_draft jsonb, p_step integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.onboardings;
begin
  select * into o from public.onboardings where token_hash = public.hash_token(p_token);
  if o.id is null or o.status not in ('invited','in_progress') then return jsonb_build_object('error', 'invalid'); end if;
  if o.token_expires_at < now() then return jsonb_build_object('error', 'expired'); end if;
  if length(p_draft::text) > 200000 then raise exception 'Too much data'; end if;
  update public.onboardings set draft = p_draft, step = greatest(1, least(coalesce(p_step, 1), 6)), status = 'in_progress'
    where id = o.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.onboarding_sign(p_token text, p_signature text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.onboardings; p public.people; t public.contract_templates; d jsonb; body text; c jsonb;
begin
  select * into o from public.onboardings where token_hash = public.hash_token(p_token);
  if o.id is null or o.status not in ('invited','in_progress') then return jsonb_build_object('error', 'invalid'); end if;
  if o.token_expires_at < now() then return jsonb_build_object('error', 'expired'); end if;
  if length(trim(coalesce(p_signature, ''))) < 3 then raise exception 'Please type your full name to sign'; end if;
  d := o.draft;
  select * into p from public.people where id = o.person_id;
  if o.template_id is not null and (d->>'agreed') is distinct from 'true' then
    raise exception 'Please confirm you have read the agreement';
  end if;

  body := public.onboarding_render(o.id);
  if body is not null then
    select * into t from public.contract_templates where id = o.template_id;
    insert into public.signed_agreements (person_id, onboarding_id, template_id, template_name, template_version, body_text, signature_name, pdf_path)
    values (p.id, o.id, t.id, t.name, t.version, body, trim(p_signature), nullif(d->>'signed_pdf_path', ''));
  end if;

  insert into public.person_private as pp (person_id, date_of_birth, address, address_line1, address_line2, town, postcode, county,
      ni_number, utr, bank_name, account_number, sort_code, company_name, company_number, starter_statement, student_loan,
      emergency_name, emergency_phone, emergency_relationship, updated_at)
  values (p.id, nullif(d->'personal'->>'dob', '')::date,
      array_to_string(array[coalesce(d->'personal'->>'address_line1', ''), coalesce(d->'personal'->>'address_line2', ''),
        coalesce(d->'personal'->>'town', ''), coalesce(d->'personal'->>'postcode', ''), coalesce(d->'personal'->>'county', '')], E'\n'),
      coalesce(d->'personal'->>'address_line1', ''), coalesce(d->'personal'->>'address_line2', ''),
      coalesce(d->'personal'->>'town', ''), coalesce(d->'personal'->>'postcode', ''), coalesce(d->'personal'->>'county', ''),
      coalesce(d->'tax'->>'ni_number', ''), coalesce(d->'tax'->>'utr', ''), coalesce(d->'tax'->>'bank_name', ''),
      coalesce(d->'tax'->>'account_number', ''), coalesce(d->'tax'->>'sort_code', ''), coalesce(d->'tax'->>'company_name', ''),
      coalesce(d->'tax'->>'company_number', ''), coalesce(d->'tax'->>'starter_statement', ''),
      coalesce((d->'tax'->>'student_loan')::boolean, false), coalesce(d->'safety'->'emergency'->>'name', ''),
      coalesce(d->'safety'->'emergency'->>'phone', ''), coalesce(d->'safety'->'emergency'->>'relationship', ''), now())
  on conflict (person_id) do update set
      date_of_birth = excluded.date_of_birth, address = excluded.address, address_line1 = excluded.address_line1,
      address_line2 = excluded.address_line2, town = excluded.town, postcode = excluded.postcode, county = excluded.county,
      ni_number = excluded.ni_number, utr = excluded.utr, bank_name = excluded.bank_name,
      account_number = excluded.account_number, sort_code = excluded.sort_code, company_name = excluded.company_name,
      company_number = excluded.company_number, starter_statement = excluded.starter_statement,
      student_loan = excluded.student_loan, emergency_name = excluded.emergency_name,
      emergency_phone = excluded.emergency_phone, emergency_relationship = excluded.emergency_relationship,
      updated_at = now();

  if ((d->'safety'->>'site_work') = 'true' or p.person_type = 'subcontractor') and d ? 'health' then
    insert into public.person_health (person_id, data, updated_at) values (p.id, d->'health', now())
    on conflict (person_id) do update set data = excluded.data, updated_at = now();
  else
    delete from public.person_health where person_id = p.id;
  end if;

  delete from public.person_certificates where person_id = p.id and source = 'onboarding';
  for c in select * from jsonb_array_elements(coalesce(d->'certs', '[]'::jsonb)) loop
    insert into public.person_certificates (person_id, kind, number, expiry_date, file_path)
    values (p.id, coalesce(c->>'kind', 'other'), coalesce(c->>'number', ''), nullif(c->>'expiry', '')::date, nullif(c->>'file_path', ''));
  end loop;
  if nullif(d->'rtw'->>'file_path', '') is not null then
    insert into public.person_certificates (person_id, kind, number, file_path)
    values (p.id, 'right_to_work', '', d->'rtw'->>'file_path');
  end if;

  update public.people set phone = coalesce(nullif(d->'personal'->>'phone', ''), phone),
    engagement_type = case when person_type = 'subcontractor'
      then coalesce(nullif(d->'tax'->>'engagement_type', ''), engagement_type) else engagement_type end,
    updated_at = now() where id = p.id;
  update public.onboardings set status = 'signed', signed_at = now(), token_hash = null, token_expires_at = null where id = o.id;
  return jsonb_build_object('ok', true);
end $$;

-- --------------------------------------------------------------- grants
revoke all on function public.assert_admin(), public.onboarding_render(uuid), public.onboarding_upload_ok(text),
  public.onboarding_create(text,text,text,text,uuid,text,date,numeric,text,text,uuid),
  public.onboarding_reissue(uuid), public.onboarding_review(uuid,boolean,text),
  public.onboarding_get(text), public.onboarding_save(text,jsonb,integer), public.onboarding_sign(text,text) from public;
grant execute on function public.onboarding_create(text,text,text,text,uuid,text,date,numeric,text,text,uuid) to authenticated;
grant execute on function public.onboarding_reissue(uuid) to authenticated;
grant execute on function public.onboarding_review(uuid,boolean,text) to authenticated;
grant execute on function public.onboarding_get(text) to anon, authenticated;
grant execute on function public.onboarding_save(text,jsonb,integer) to anon, authenticated;
grant execute on function public.onboarding_sign(text,text) to anon, authenticated;
grant execute on function public.onboarding_upload_ok(text) to anon, authenticated;

-- -------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('onboarding-docs', 'onboarding-docs', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

drop policy if exists onboarding_docs_upload on storage.objects;
create policy onboarding_docs_upload on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'onboarding-docs' and public.onboarding_upload_ok((storage.foldername(name))[1]));

drop policy if exists onboarding_docs_admin_read on storage.objects;
create policy onboarding_docs_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'onboarding-docs' and public.current_role() = 'admin' and public.mfa_ok());

drop policy if exists onboarding_docs_admin_delete on storage.objects;
create policy onboarding_docs_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'onboarding-docs' and public.current_role() = 'admin' and public.mfa_ok());
