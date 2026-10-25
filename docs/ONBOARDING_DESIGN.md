# AGS Eco System: People onboarding design

Status: **for review, no code yet.** Written 25 Oct 2026. Based on the current system's sub-contractor onboarding (reference file) and the People design (`PEOPLE_DESIGN.md`).

Scope: **employees and sub-contractors, one process.** Agencies are suppliers and have their own, different process, so they are excluded.

## 1. One process, two types

The person is added once, completes the same form, and the result is filed on their People profile. Only three things differ by type.

| Step | Employee | Sub-contractor |
| --- | --- | --- |
| 1. Office adds person | Name, email, phone, job role, start date, pay | Name, email, phone, trade, rate and basis, individual or limited company |
| 2. Invite | Same: one-time link, 7 days | Same |
| 3. Self-service form | Same six steps (section 3), with one tax block that differs | Same |
| 4. Agreement | Contract of employment, built from Settings, People & HR | Sub-contractor agreement (no hours, no direction of work) |
| 5. Office review | Right-to-work check recorded, then Accept or Reject | CIS and status check recorded, then Accept or Reject |
| 6. On Accept | Employee record active, login invite sent | Supplier, worker and engagement active, login invite sent |

## 2. The flow

1. **Office adds the person** from People. The rate or pay is needed up front because the invite builds the agreement from it.
2. **Invite** goes to the person. Link is random, expires in 7 days, is checked on every request, and is used up when the agreement is signed. Staff can resend.
3. **Person fills in the form** on a public page, no login, saved as they go so they can stop and return on the same link.
4. **Person reads and signs** the agreement with a typed name.
5. **Office reviews** everything and Accepts or Rejects (a reason is required, and a rejected person can be invited again). This is the approval gate.
6. **On Accept** the profile goes live, documents and expiry dates are filed, and a **second, separate** invite lets the person set a password. Signing the paperwork does not give a login.

## 3. The form: six steps, same for both

1. **Personal:** full name, date of birth, phone, email, address, postcode.
2. **Tax and bank:** National Insurance number and bank details for both. Sub-contractors add their UTR and, if a limited company, the company name and number. Employees add the starter declaration (first job this tax year, other jobs, student loan). *Subject to your decision on holding this data.*
3. **Emergency contact and site safety:** **one** emergency contact (the old system had two separate fields for the same thing), and the health checklist (conditions ticked one by one, each asking how controlled and what medication, plus doctor details; see section 6).
4. **Right to work, skills and certificates:**
   - Employees: right-to-work document, which the office then checks.
   - Everyone: CSCS card (required where the person goes on site), plus any other certificates (first aid, SSSTS, SMSTS, working at height, IPAF, PASMA, asbestos awareness, manual handling). Each has a type, number, expiry date and a photo.
   - Sub-contractors: public liability insurance, with expiry and a photo.
5. **Agreement review:** shown from the same template used for the signed copy, so the screen and the document cannot differ. The person ticks to say they have read it.
6. **Sign:** typed name, with the date and time recorded.

Work types, trades, notes and "use again" flags are **not** asked on this form. The office sets them on review, because self-reported skills should not configure permissions.

## 4. What it fills in on the People profile

Everything lands on the one profile, in the same tabs for both types: **Profile, Documents, Compliance, Agreement, Onboarding history**. Employees also get Employment and Time away. Sub-contractors also get Engagement and Status checks. Nothing about leave or hours appears on a sub-contractor, as set out in the People design.

Certificates become compliance items with expiry dates, so the dashboard's "compliance expiring" tile fills itself.

## 5. Data and security

- **New tables:** `onboardings` (type, status, token hash and expiry, who invited, dates), `person_private` (date of birth, NI, UTR, bank; admin-only), `person_health` (conditions, medication, doctor; admin-only, separate from the rest), `person_certificates`, `signed_agreements` (append-only, each with the frozen wording, merged values and signature), and a private storage bucket for uploads.
- **Statuses:** invited, in progress, signed, accepted, rejected, expired.
- **Files** are stored in a private bucket, with short-lived links, not as image text inside the database. This was the open question in the reference, and the answer I recommend is real file storage.
- **Sensitive fields** (NI, UTR, bank, health) sit in a separate table that only admins can read, with 2FA enforced in the database. A sub-contractor can never read another's record. Everything a person sees is found from their own login, never from an ID they send.
- **The public form** works through the one-time link only. It runs through server functions that check the token each time, with Cloudflare rate limiting in front once the domain is live.
- **Archive, never overwrite:** re-signing next year adds a new `signed_agreements` row.
- **Reminders:** an expiry reminder 30 days before an agreement or certificate lapses, when email is connected.
- **Email:** until sending is set up, the Add screen shows a **Copy invite link** button to send by WhatsApp or email yourself. Automatic email comes with the integrations work.
- **Not in this build:** automatic Xero contact creation (comes with Finance), and any automated CIS verification. CIS stays a manual check.

## 6. Decisions

Agreed 25 Oct 2026:
1. **Health information: full checklist, as in the old system** (conditions, how controlled, medication, doctor details). This is special category data under UK GDPR, so it comes with safeguards: its own table readable by admins only; a short notice on the form saying why it is asked and who sees it; it is only asked of people who will be on site; a retention rule (deleted a set time after the person leaves, period to be agreed with your adviser); and it is never shown on dashboards, lists or the Team directory. A data protection impact assessment is worth doing before it goes live.
2. **NI numbers, UTRs and bank details: held in the system**, in the admin-only `person_private` table.
3. **Invites: Copy invite link** until email is connected.

Still open:
4. **Agreement wording.** The employee contract and the sub-contractor agreement need solicitor wording. The MD agreement is already drafted. The sub-contractor agreement must not read like employment.
5. **Styling.** Each public page uses the AGS look (Cormorant headings, Jost body, light default with the dark switch), one column, large touch targets, since sub-contractors will use phones.

## 7. Build order

1. Tables, storage bucket and the People profile tabs
2. Add person, invite link and resend
3. Public form, six steps with autosave
4. Agreement merge and typed signature
5. Office review (Accept and Reject) and filing to the profile
6. Login invite after Accept
7. Expiry reminders and the dashboard tile

## 8. Build status (25 Oct 2026)

Built and tested against a scratch database (create, link, save, sign, review, and that a visitor with no login cannot read any table):
- Migration `0011_people_onboarding.sql`: tables, token functions, storage bucket and policies
- People page: Overview, Employees and Sub-contractors tabs; **Add person** with a copy-link invite; a person profile with Profile, Documents, Agreement and Health tabs; Accept and Reject
- Public form at `/onboard/<link>`: six steps with autosave, document upload and typed-name signature

Added 25 Oct 2026: the existing painter and decorator **sub-contractor agreement** is loaded as a template (migration `0012`), with its Schedule turned into fields (agreement number AGS-SC-0001 counting up, date, name and address, commencement and completion dates, rate). It is a draft pending solicitor review; the notes for the solicitor are in `docs/contracts/subcontractor-agreement.notes.md`.

Added 25 Oct 2026 (signed PDF and expiry management):
- **Signed agreement PDF.** When someone signs, a PDF of the exact wording plus the typed-name signature block is built in the browser, stored in the private `onboarding-docs` bucket and linked to the signed record (`signed_agreements.pdf_path`). Office download it from the person's Agreement tab (if one is missing it is rebuilt from the frozen wording); the person gets a copy on the thank-you page. Needs the `jspdf` package.
- **Expiry management (migration `0013`).** One source of truth: `person_certificates.expiry_date`. The latest certificate of each kind is the current one, so adding a renewal replaces the old one. Views of the same data: a **Compliance** tab on People (expired / 30 days / 60 days, filters), a dashboard tile for admins, an **Add or renew certificate** button on the person's Documents tab. We do not create hand-made tasks or a separate calendar; a Tasks module will later create "Chase renewal" tasks from this data and a Calendar module will show it.
- **Reminders.** `compliance_due()` lists what needs an email now (30, 14, 7 days before and on expiry, to the person and to AGS) and `compliance_reminders` logs what has been sent so nothing goes twice. The sending itself needs an email route (not yet chosen).

Not yet built: the standard employee contract wording, status-check records on review, sending of the reminder emails (and invite emails), annual reconfirmation reminders.
