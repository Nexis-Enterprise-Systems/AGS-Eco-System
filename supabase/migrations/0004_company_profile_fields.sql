-- Company profile fields.
--
-- Adds the additional company-identity fields needed on the new
-- Company Profile page (System Settings -> Company Profile): a
-- trading name, registered address, region (drives which label the
-- registration-number field shows), business registration/licence
-- number, and VAT number. All nullable except region, which defaults
-- to 'gb'.
--
-- Region is deliberately NOT editable in the app's UI — a company's
-- registration jurisdiction doesn't change, so exposing it as a
-- dropdown risked someone flipping it by mistake. Set it once here at
-- build time instead, right after running this migration:
--   update public.system_settings set region = 'ae' where id = true;
-- ('gb', 'ae', or 'other' — see the check constraint below.)
--
-- Run this once per client project, after 0001/0002/0003. For a
-- project that already has those three applied, this file is safe to
-- run on its own — it only adds columns and a check constraint,
-- nothing else changes.

alter table public.system_settings
  add column if not exists trading_name text,
  add column if not exists address text,
  add column if not exists region text not null default 'gb',
  add column if not exists business_registration_number text,
  add column if not exists vat_number text;

-- 'gb' (United Kingdom) / 'ae' (United Arab Emirates) / 'other' — drives
-- the Company Profile page's label for business_registration_number
-- ("Companies House Number" / "Trade License Number" / "Business
-- Registration Number"). Extend this list (and the page's REGION
-- options) if a client is based somewhere else.
alter table public.system_settings
  drop constraint if exists system_settings_region_ck;

alter table public.system_settings
  add constraint system_settings_region_ck check (region in ('gb', 'ae', 'other'));
