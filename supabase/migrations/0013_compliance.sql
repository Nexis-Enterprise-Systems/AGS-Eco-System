-- 0013: Compliance — certificate expiry tracking and reminder queue.
-- One source of truth: person_certificates.expiry_date. Everything else
-- (the Compliance page, the dashboard tile, reminder emails, later tasks and
-- calendar) is computed from it. Safe to re-run.

-- The current certificate of each kind for each active person: the latest
-- expiry wins, so a renewed ticket replaces the old one automatically.
-- 'Other' certificates are tracked separately by number.
create or replace view public.compliance_current
with (security_invoker = true) as
select distinct on (c.person_id, c.kind, case when c.kind = 'other' then c.number else '' end)
  c.id as certificate_id,
  c.person_id,
  p.full_name,
  p.email,
  p.person_type,
  c.kind,
  c.number,
  c.expiry_date,
  c.file_path,
  (c.expiry_date - current_date) as days_left
from public.person_certificates c
join public.people p on p.id = c.person_id
where p.status = 'active' and c.expiry_date is not null
order by c.person_id, c.kind, case when c.kind = 'other' then c.number else '' end, c.expiry_date desc, c.created_at desc;

-- Log of reminders: one row per certificate, window and audience, so a
-- reminder is never sent twice.
create table if not exists public.compliance_reminders (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.person_certificates(id) on delete cascade,
  window_days integer not null check (window_days in (30, 14, 7, 0)),
  audience text not null check (audience in ('person', 'office')),
  status text not null default 'sent' check (status in ('sent', 'failed')),
  error text,
  sent_at timestamptz not null default now(),
  unique (certificate_id, window_days, audience)
);
alter table public.compliance_reminders enable row level security;
drop policy if exists compliance_reminders_admin on public.compliance_reminders;
create policy compliance_reminders_admin on public.compliance_reminders for all
  using (public.current_role() = 'admin' and public.mfa_ok())
  with check (public.current_role() = 'admin' and public.mfa_ok());

-- What needs a reminder right now. Windows: 30, 14, 7 days before expiry and
-- on/after expiry (0). Only the current window is returned, so if reminders
-- were switched off for a while nobody gets three emails at once.
create or replace function public.compliance_due(p_today date default current_date)
returns table (
  certificate_id uuid, person_id uuid, full_name text, email text, kind text, number text,
  expiry_date date, days_left integer, window_days integer, audience text
)
language sql security definer set search_path = public as $$
  select cc.certificate_id, cc.person_id, cc.full_name, cc.email, cc.kind, cc.number, cc.expiry_date,
         (cc.expiry_date - p_today)::integer,
         w.win, a.aud
  from public.compliance_current cc
  cross join lateral (
    select case
      when cc.expiry_date - p_today <= 0 then 0
      when cc.expiry_date - p_today <= 7 then 7
      when cc.expiry_date - p_today <= 14 then 14
      else 30 end as win
  ) w
  cross join (values ('person'), ('office')) as a(aud)
  where cc.expiry_date - p_today <= 30
    and not exists (
      select 1 from public.compliance_reminders r
      where r.certificate_id = cc.certificate_id and r.window_days = w.win and r.audience = a.aud
    )
$$;

create or replace function public.compliance_mark_sent(p_certificate uuid, p_window integer, p_audience text, p_status text default 'sent', p_error text default null)
returns void
language sql security definer set search_path = public as $$
  insert into public.compliance_reminders (certificate_id, window_days, audience, status, error)
  values (p_certificate, p_window, p_audience, coalesce(p_status, 'sent'), p_error)
  on conflict (certificate_id, window_days, audience)
  do update set status = excluded.status, error = excluded.error, sent_at = now()
$$;

-- Only the server-side sender (service role) may use these two.
revoke all on function public.compliance_due(date), public.compliance_mark_sent(uuid, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.compliance_due(date), public.compliance_mark_sent(uuid, integer, text, text, text) to service_role;

grant select on public.compliance_current to authenticated;

-- Office can upload and replace certificate files for a person.
drop policy if exists onboarding_docs_admin_upload on storage.objects;
create policy onboarding_docs_admin_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'onboarding-docs' and public.current_role() = 'admin' and public.mfa_ok());
