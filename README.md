# NEXIS Client Platform — Base Template

This is the standalone base template NEXIS Enterprise Systems builds
out for each client engagement. It is deliberately **not multi-tenant**
— every client gets their own Supabase project and their own Railway
deployment, so a client who takes the System Buyout option receives a
genuinely standalone system with nothing shared with any other client.

## What's in here

- **System Settings** — Business Units (company profile and branding
  colours per unit, driving the interface via CSS variables — change
  them and the whole app re-themes instantly, no redeploy) and the
  Integrations panel: accounting (Xero / QuickBooks / Zoho Books) and
  email (Google / Microsoft) as real API connections, and UAE WPS
  payroll / bulk bank payment files clearly labelled as
  file-generation only — there is no public API for either in the UAE
  today, so this app is honest about that rather than promising
  something it can't deliver.
- **Business Units** — every client starts with one unit (Head Office);
  a client structured as a Head Office plus separate, possibly
  separately-registered business units can add more, each optionally
  its own legal entity and optionally its own branding. See
  `MULTI_ENTITY_SPEC.md` for the full design.
- **Clients** — CRUD, plus bulk import from CSV or Excel with column
  mapping and a preview before committing.
- **Projects** — CRUD, linked to a client, with a stage pipeline
  (discovery → audit → proposal → agreement → build → rollout →
  retainer → complete), plus the same CSV/Excel import.
- **Sub-Contractor Management** — a roster of external team members,
  assigned per-project. Row Level Security scopes a sub-contractor's
  login to only the clients/projects they're assigned to.
- **Audit reference documents** — each project has a Documents tab for
  the audit export, findings document, commercial proposal and
  engagement agreement that led to it — internal reference for the
  build team, never shown to the client or sub-contractors.
- **Auth & roles** — Supabase Auth (email/password) with three roles:
  `admin`, `staff`, `subcontractor`. The sidebar and every table's Row
  Level Security policy both key off this role.
- **Self-service onboarding.** An admin adds or bulk-imports (CSV/Excel)
  the email addresses they expect to sign up on the **Invited Users**
  page, then sends everyone the same `/signup` link. Each person picks
  their own password there — no more creating accounts one at a time
  in Supabase's Authentication → Users screen. Enforced at the database
  level (`supabase/migrations/0003_self_signup.sql`): an email not on
  the list is refused a login at all, not just hidden by the UI. A
  sub-contractor invite auto-links to their existing roster entry (by
  email) if one's already been added on the Sub-Contractors page.
  Self-signup can only ever create `staff` or `subcontractor` accounts
  — a new admin is still a manual step, on purpose.
- **Two-factor authentication — mandatory, not optional.** Every
  account, every role, is required to set up a TOTP authenticator app
  (Google Authenticator, Authy, 1Password, etc. — not SMS, so no
  per-message cost or UAE carrier setup) on its very first login,
  before it can reach anything else. This is enforced twice: the app
  itself won't route a session past `/mfa-setup` or `/mfa-challenge`
  until it's done, AND — the part that actually matters for
  security — `supabase/migrations/0002_mandatory_mfa.sql` requires a
  verified 2FA session (`aal2`) inside the Row Level Security policies
  themselves, so even a request that bypasses the app entirely and
  hits Supabase's API directly with a password-only session is
  refused at the database, not just hidden by the UI.

## Stack

Vite + React + TypeScript + Tailwind CSS (CSS-variable-driven theme),
Supabase (Postgres + Auth + Storage) as the backend, deployable to
Railway.

## Setting up a new client

1. **Create a new Supabase project** for this client at
   [supabase.com](https://supabase.com) (Free or Pro tier depending on
   expected usage). Note the project URL and anon key from
   **Settings → API**.
2. **Run the schema.** In the Supabase dashboard, open the **SQL
   Editor**, paste the contents of `supabase/migrations/0001_init.sql`,
   and run it. This creates every table, the `admin/staff/subcontractor`
   roles, Row Level Security policies, and the `audit-documents` /
   `branding` storage buckets. Then paste and run
   `supabase/migrations/0002_mandatory_mfa.sql` — this is what makes
   2FA mandatory at the database level, not just in the app's UI. Then
   paste and run `supabase/migrations/0003_self_signup.sql` — this adds
   the Invited Users allowlist and the public `/signup` page's database
   enforcement. Then paste and run
   `supabase/migrations/0004_company_profile_fields.sql` — this adds
   the trading name, address, region, registration number and VAT
   number fields used on the Company Profile page. Always run all four,
   in that order, for every new client project.

   **Set this client's region** right after 0004 — it's not editable in
   the app (see that migration's comment for why), so it has to be set
   here, once:
   ```sql
   update public.system_settings set region = 'ae' where id = true;
   ```
   Use `'gb'` for a UK client, `'ae'` for a UAE client, or `'other'`
   otherwise.

   Then paste and run `supabase/migrations/0005_business_units.sql` —
   this adds multi-entity support (a client that's a Head Office plus
   separate business units, each optionally its own legal entity with
   its own registration/VAT number, each optionally its own branding).
   Safe to run even for a single-entity client that will never need
   this — see `MULTI_ENTITY_SPEC.md` at the repo root for the full
   design; nothing changes for a client that only ever has one unit.
   Then paste and run `supabase/migrations/0006_business_units_phase2.sql`
   — this adds the pieces the Business Units admin UI needs: a
   pre-auth branding lookup for the Login/Signup screens, and an
   update to the self-signup trigger so an invite's assigned business
   unit actually lands on the new account. Always run 0005 and 0006
   together, in that order — the app's System Settings → Business
   Units page won't work correctly with only one of the two applied.
3. **Create the first (admin) user.** After 0003 has run, *every* new
   account — including your own first one — must have a matching row
   in `invited_users` before it can be created at all. In the SQL
   Editor, run:
   ```sql
   insert into public.invited_users (email, full_name, role)
   values ('you@yourcompany.com', 'Your Name', 'admin');
   ```
   Then either add yourself in **Authentication → Users**, or just go
   to `/signup` once the app is running (step 5) and create the
   account yourself like anyone else. A `profiles` row is created
   automatically with the role from that `invited_users` row — for an
   `admin` invite, that means it's already `admin`, no manual promotion
   needed. (For any `staff`/`subcontractor` account, use the **Invited
   Users** page in the app instead of the SQL Editor — see step 8.)
4. **Configure environment variables.** Copy `.env.example` to
   `.env.local` and fill in this client's Supabase URL and anon key.
5. **Install dependencies and run locally:**
   ```bash
   npm install
   npm run dev
   ```
   This sandbox's own network is locked down to a small allowlist that
   does not include the npm registry, so `npm install` was **not** run
   inside this delivery — it needs to run once on a machine with normal
   internet access (your Mac, or directly on Railway during deploy).
   That's standard for any Node project pulled from git; nothing here
   is missing or broken, it just hasn't fetched its dependencies yet.
6. **First login:** go to `/login` and sign in with the user created
   in step 3.
   That first login will immediately land on the 2FA setup screen —
   this can't be skipped. Scan the QR code with an authenticator app
   and enter the code it shows to confirm. Every user does this for
   their own account on their first login; there's no separate admin
   step, and no way to use the app without it.
7. **Set branding:** as an admin, open **System Settings → Business
   Units**, click into **Head Office** (every client has this one unit
   by default), and set the company name, logo, and the client's own
   colour palette (primary / secondary / accent, as R G B triplets or
   via the colour pickers). Saving applies immediately. Only add a
   second business unit here if this client actually needs one — see
   `MULTI_ENTITY_SPEC.md`.
8. **Onboard the rest of the team:** as an admin, open **Invited
   Users** and add or import (CSV/Excel) everyone's work email. Copy
   the signup link shown on that page and send it out however you
   normally would (email, WhatsApp, Slack) — each person visits it,
   confirms their own email is recognized, and sets their own
   password. They'll land on the same mandatory 2FA setup screen as
   everyone else on their first login.

   By default, Supabase also emails each person a confirmation link
   before their account is fully active (**Authentication → Providers
   → Email → Confirm email**) — leave that on if you want proof they
   own the inbox, or turn it off for one less step if you're inviting
   people you already trust.
9. **Import data:** use **Clients → Import CSV/Excel** and
   **Projects → Import CSV/Excel** for bulk data entry, or add records
   one at a time with the "+ Add" buttons.

## Deploying to Railway

1. Push this repo to a new GitHub repository (one per client, or one
   repo with a Railway environment per client — either works).
2. In Railway, create a new project from that repo. `railway.json` is
   already configured: it runs `npm ci && npm run build` at build time
   and `npm run start` (a static preview server) at runtime.
3. Add the same two environment variables from `.env.local`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in Railway's
   **Variables** tab — Vite bakes them into the build, so they must be
   set *before* the build runs, not just at runtime.
4. Deploy. Railway assigns a URL; point the client's domain at it once
   they're happy with a Railway-provided preview.

## System Buyout handoff

When a client takes the System Buyout option: transfer ownership of
their Supabase project to their own organisation (Supabase supports
transferring project ownership), transfer or re-point the GitHub repo
and Railway project the same way, and hand over the `.env.local`
values. Nothing in this codebase phones home to NEXIS or to any other
client's data — each deployment is fully self-contained by design.

## Extending this template

- New modules follow the same pattern as Clients/Projects/Sub-Contractors:
  a Supabase table + RLS policy in a new migration file, a row of
  fields in `src/lib/types.ts`, and a page built on the shared
  `useTable` hook (`src/hooks/useTable.ts`), `DataTable` component, and
  `ImportModal` component — none of those three need to change.
- To add a real API integration beyond the starting catalogue, extend
  `INTEGRATION_CATALOGUE` in `src/hooks/useIntegrations.ts` and wire an
  OAuth flow (a Supabase Edge Function is the natural place to keep
  the client secret server-side — never put it in `config` on the
  `integrations` table, which is readable by any staff user).
