# Multi-Entity / Business Units — Spec

Status: **Phases 1–5 built (21 Sep 2026)** — schema/RLS/migration, the
Business Units admin page, branding inherit/override, Invited Users
unit assignment, and the Head Office business-unit switcher are all
live. Only Phase 6 (retiring `system_settings`) remains, and it's
deliberately left for later — see "Build phases" below. This doc is
both the engineering spec and something Aaron can lift from directly
when pitching this as a tier to a client (see "Positioning" at the
end).

## Why

Today, one deployment of `nexis-client-platform` = one company = one
login pool = one shared pool of Clients/Projects/Sub-Contractors. That
covers a normal single-entity client fine, but breaks down for a
client structured as a Head Office plus separate business units — for
example a Dubai-headquartered group with its own Abu Dhabi office, or
a UK company that later opens a second, separately-registered office.

Two cases came up while scoping this, and both have to work:

1. **A business unit is legally its own entity** — its own trade
   licence/registration number, possibly its own VAT number, possibly
   even its own region (a UK company's second office could be a
   different UK entity, or could be a first entry into the UAE).
2. **A business unit keeps its own brand** even though it's owned by
   the parent — common when the parent grew by acquisition and the
   acquired company's market-facing identity is worth more intact than
   rebranded. Other units are happy to just look like the parent.

The design below supports both without forcing every client through
the complexity — a client with one office never has to think about any
of this; it only activates when a second business unit is added.

## Data model

### `business_units` (new table)

One row per business unit, one of which is flagged `is_head_office`.
Carries exactly the fields the single-entity Company Profile page
already had — this is that same set of fields, now per-unit instead of
once:

- `company_name`, `trading_name`
- `contact_email`, `contact_phone`, `address`
- `region` (`gb` / `ae` / `other` — same as before, drives the
  registration-number field's label)
- `business_registration_number`, `vat_number`
- Branding: `use_custom_branding` (boolean), plus `logo_url` and the
  seven colour tokens. When `use_custom_branding` is false, the unit
  is rendered using the Head Office unit's branding instead — a unit
  never has to fill these in unless it actually wants its own look.

Exactly one unit must have `is_head_office = true` (enforced with a
partial unique index) — that unit's branding is the fallback for every
other unit, and it's what an unauthenticated visitor sees on the login
screen before anyone's identified themselves.

### Scoping columns (new, on existing tables)

- `clients.business_unit_id` — **not null**. Every client belongs to
  exactly one business unit.
- `sub_contractors.business_unit_id` — **not null**. A sub-contractor
  is on one unit's roster (the unit that engaged them).
- `profiles.business_unit_id` — **nullable**. `null` means "all
  units" — this is how a Head Office admin/exec sees everything. A
  non-null value scopes that person to one unit only, regardless of
  whether their role is `admin` or `staff` (a unit can have its own
  local admin who manages that unit's profile/branding/team without
  seeing any other unit).
- `invited_users.business_unit_id` — **nullable**, same meaning — the
  inviting admin sets this per invite so the person lands in the right
  unit (or with full access) the moment they sign up.

`projects` and `project_subcontractors` deliberately do **not** get
their own `business_unit_id` — a project's unit is always its client's
unit, and a sub-contractor's project assignments are always within
their own unit's projects. Deriving it through the existing
relationship (`projects.client_id → clients.business_unit_id`) instead
of duplicating the column removes an entire class of "unit mismatch"
bugs (a project pointing at a different unit than its own client).

### Row Level Security

Every policy that used to just check "is this person staff/admin" now
also checks "does this row's business unit match theirs, or do they
have all-unit access (`business_unit_id is null`)". A new
`current_business_unit_id()` helper (mirrors the existing
`current_role()` pattern) reads the caller's own scope once per query,
avoiding recursive RLS lookups.

`business_units` itself: any authenticated user can read every unit
(needed for branding to resolve before role-specific data loads); only
a Head Office admin (`role = 'admin'` and `business_unit_id is null`)
can create or delete a unit; a unit's own admin can update that one
unit's row (their own profile/branding) but not anyone else's.

### Migrating existing data safely

This has to run against **Aaron's already-populated demo project**,
and eventually against real client projects with real data in them, so
it can't be destructive. The migration:

1. Creates `business_units`.
2. Seeds exactly one row from whatever's currently in the
   `system_settings` singleton, flagged `is_head_office = true`, with
   `use_custom_branding = true` (so it keeps exactly the branding it
   already had).
3. Adds the new `business_unit_id` columns, backfills every existing
   `clients`/`sub_contractors` row to that one new unit, *then* makes
   the column not-null.
4. Leaves every existing `profiles` row's `business_unit_id` as
   `null` — meaning nothing changes for anyone until an admin
   deliberately scopes a specific person to a specific unit. A
   single-entity client that never adds a second business unit sees no
   behavioural change at all.

`system_settings` is left in place, untouched, for now (see Build
phases) — nothing currently reading it breaks the moment this
migration runs.

## UI changes (Phases 2–5 — built, 21 Sep 2026)

- **Business Units admin page** (`System Settings → Business Units`,
  `src/pages/settings/BusinessUnits.tsx` + `BusinessUnitDetail.tsx`) —
  a list of every unit (Head Office badge-marked, always first) plus a
  detail page per unit with the same fields the old single Company
  Profile page had. Head Office admins can add units (a small modal:
  company name + region, since region is locked once set — same
  reasoning as the original single-entity Company Profile) and delete
  non-Head-Office units (blocked by the database's own foreign-key
  constraints while a unit still has clients or sub-contractors — no
  silent data orphaning); a unit's own local admin only sees and edits
  their own unit. The old `/settings/profile` and `/settings/branding`
  routes now redirect here (to the Head Office unit) rather than
  disappearing, so no existing bookmark breaks.
- **Branding inherit/override** — each unit's detail page has a "Use
  this unit's own branding" toggle (`use_custom_branding`), off by
  default, with a logo upload and the same three colour pickers the
  old Company Branding page had. Off shows a small "currently showing
  Head Office's branding" preview instead.
- **Login and Signup pages** resolve branding *before* knowing who's
  signing in, via a new `get_head_office_branding()` RPC
  (`supabase/migrations/0006_business_units_phase2.sql`) rather than a
  direct table read — `business_units`' RLS only allows authenticated
  reads, and even if it didn't, a table read would hand an anonymous
  visitor every other unit's contact/registration details too.
- **Sidebar business-unit switcher** — a Head Office admin
  (`business_unit_id is null`) with more than one unit gets a "Viewing
  as" dropdown (unit, or "All units"); a unit-scoped person never sees
  it. This is a client-side view filter only, not a permissions
  change — Head Office already receives every unit's rows from Row
  Level Security (that's what `business_unit_id is null` means); the
  switcher narrows what Clients, Sub-Contractors, Projects and the
  Dashboard *display*, and what unit a newly-created client/
  sub-contractor/invite defaults into.
- **Invited Users** — a "New invites go to" picker (Head Office admins
  only; a unit-scoped admin can only ever invite into their own unit,
  enforced by RLS too — see `0006_business_units_phase2.sql`).
  `handle_new_user()` now copies `business_unit_id` from the accepted
  invite onto the new profile — without this, every self-signup would
  have landed with `null` (full access) regardless of which unit they
  were actually invited into.
- **Dashboard**: rolls up to whichever scope the viewer has — one
  unit's numbers when scoped or switched to a unit, or (for Head
  Office viewing "All units", when more than one unit exists) both a
  combined total and a per-unit breakdown table.

## Explicitly out of scope for now

- **Integrations** (Xero/QuickBooks/Zoho/etc.) staying global rather
  than per-unit. A UAE unit and a UK unit will often want genuinely
  different accounting connections — but Integrations aren't even
  live yet (see the "Coming soon" note elsewhere), so scoping them per
  unit is a problem for whenever that gets built, not now.
- A hard database constraint preventing a sub-contractor being
  assigned to a project outside their own unit — worth adding once
  there's a real multi-unit client to test it against; not required
  for the schema to be correct today.

## Build phases

1. **Schema + RLS + safe data migration** — `DONE, 21 Sep 2026`
   (`supabase/migrations/0005_business_units.sql`).
2. **Business Units admin page** (list + detail, replaces the single
   Company Profile page) — `DONE, 21 Sep 2026`.
3. **Branding inherit/override wiring** (unit detail page, Login/Signup
   pages, Sidebar) — `DONE, 21 Sep 2026`
   (`supabase/migrations/0006_business_units_phase2.sql` +
   `src/context/BusinessUnitContext.tsx`).
4. **Invited Users unit assignment** (+ `handle_new_user()` update) —
   `DONE, 21 Sep 2026`.
5. **Business-unit switcher for Head Office roles** — `DONE, 21 Sep
   2026`, including client-side scoping of Clients/Sub-Contractors/
   Projects/Dashboard to whichever unit is being viewed.
6. **Retire `system_settings`** once nothing reads it anymore — not
   started, deliberately deferred. Nothing in the app reads or writes
   it any more as of Phase 2–5 (Login/Signup/Sidebar/Settings all moved
   to `business_units`), so this is now just a follow-up migration to
   drop the table when convenient — no rush, and no risk in leaving it
   in place a while longer.

## Positioning (for Aaron — pricing/sales framing, not engineering)

This is a genuine tier above the standard single-entity build — it's
what lets NEXIS say yes to a group structure instead of either turning
the deal down or quietly under-delivering with a workaround. Natural
fit alongside the existing Buyout/standalone-app premium options:
price it as a "Group" or "Multi-Entity" tier, either as a flat
multiplier on the base build fee or per additional business unit added
beyond the first (Head Office). Worth deciding which before it's
pitched, since "per unit" scales naturally with a client's own
expansion and gives a clean reason to come back to NEXIS every time
they open a new office.
