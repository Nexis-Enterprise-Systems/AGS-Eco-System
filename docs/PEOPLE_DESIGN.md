# AGS Eco System: People design

Status: **for review. No code has been written for this yet.** Written 25 Oct 2026.

This covers how the system holds employees, sub-contractors, agencies and the suppliers behind them. It is a design for checking, not tax or legal advice. Anything about CIS, IR35 or employment status should be signed off by AGS's accountant before it goes live.

## 1. Who works for AGS

| Type | How many | Login | Where they live |
| --- | --- | --- | --- |
| Employee | One today | Yes | People, Employees tab |
| Sub-contractor (individual or limited company, CIS) | Several | Yes, for allocated work only | People, Sub-contractors tab |
| Sub-contractor business with several workers | Occasional | One login per worker | Supplier record with several workers |
| Agency worker | Few and far between | No | Under the agency, which is a supplier |

Agencies are suppliers. An agency worker is a labour cost bought from a supplier, optionally named so you know who was on site. They are not users.

## 2. Principle: keep HR and engagement apart

HR features (holidays, sickness, appraisals, disciplinary notes, set hours, employer-directed training) exist **for employees only**. A sub-contractor's record has no such fields at all, so nobody can fill them in by habit. Treating a sub-contractor like an employee is one of the things that can push HMRC towards deciding they are one.

What sub-contractors have instead: compliance documents, status checks, their own allocated jobs, and payment.

Site-access requirements (for example a CSCS card or insurance) apply to everyone who attends site, so those use one shared compliance record for all types.

## 3. One underlying model

A sub-contractor is a **supplier** (a business or person AGS buys services from) with one or more **workers** attached. A sole trader is a supplier with one worker. A limited company with three people is a supplier with three workers. People shows the workers; Suppliers shows the businesses. Nothing is entered twice, and Finance later reads costs from one place.

### Tables

**suppliers**: id, kind (`material`, `subcontractor`, `agency`, `service`, `other`), name, legal_name, company_number, vat_number, address, contact name, email, phone, payment_terms_days, status (`active`, `paused`, `archived`), notes, business_unit_id.

**supplier_workers**: id, supplier_id, profile_id (null unless they have a login), full_name, trade, phone, email, status. Sub-contractor individuals have a profile_id. Agency workers usually do not.

**subcontractor_engagements** (one per sub-contractor supplier): supplier_id, engagement_type (`sole_trader`, `ltd_single_person`, `ltd_multi_person`), utr, cis_status (`unverified`, `gross`, `standard_20`, `higher_30`), cis_verified_on, cis_verification_ref, pricing_basis (`price_work`, `day_rate`, `hourly`, `mixed`), contract_document_id, started_on, status_review_due.

**status_determinations** (history, newest first): engagement_id, method (`cest`, `other`), result (`self_employed`, `employed`, `unclear`, `not_applicable`), determined_on, determined_by, document_id (saved copy), answers (substitution right, own tools and equipment, works for other clients, who decides how the work is done, own insurance), next_review_on, notes.

**employees**: profile_id, job_title, employment_type, start_date, end_date, line_manager_id, right_to_work_checked_on, contract_document_id, emergency_contact. No National Insurance numbers or bank details in v1.

**leave_entries** (employees only): employee_id, kind (`holiday`, `sickness`, `other`), from_date, to_date, status (`requested`, `approved`, `declined`), notes. Sickness notes are visible to the director and the employee only.

**compliance_items** (all types): subject_type (`employee`, `supplier_worker`, `supplier`), subject_id, item_type (`cscs`, `ipaf`, `pasma`, `first_aid`, `public_liability`, `employers_liability`, `rams`, `induction`, `other`), reference, issued_on, expires_on, document_id, status.

**documents**: id, storage_path, file_name, kind, uploaded_by, created_at. Private storage bucket, signed links.

**resource_allocations** (designed now, built with Jobs): job_id, resource_type (`employee`, `subcontractor_worker`, `agency_worker`), resource_id, supplier_id (for sub-contractors and agencies), start_date, end_date, rate, rate_unit, notes. Employee, sub-contractor and agency labour all use this one record, so a job's labour cost is the sum of its allocations. The schedule, sub-contractor payments and agency invoice checks all read from it.

## 4. Roles and permissions

Roles stay as three for now: **admin** (director), **staff** (employee), **subcontractor**. More come later with the client and builder portals.

| Data | Admin | Staff | Sub-contractor |
| --- | --- | --- | --- |
| Employee HR record, leave | All | Own only | None |
| Sub-contractor engagement, CIS, status checks | All | Open question below | Own compliance documents only |
| Suppliers and agencies | All | Open question below | None |
| Compliance items | All | Own, plus view of others (open question) | Own |
| Allocated jobs | All | All | Only those allocated to them |

These rules are enforced in the database with Row Level Security and the 2FA requirement, not just by hiding screens.

## 5. Screens

**People** (sidebar). Tabs: **Overview** (everyone on one list, with compliance status chips and who has something expiring), **Employees**, **Sub-contractors**. Agencies are in **Suppliers**, which is its own sidebar item.

**Employee record**: Profile, Employment, Time away, Qualifications, Documents.

**Sub-contractor record**: Business, Engagement and CIS, Status checks, Compliance documents, Workers, and later Jobs and Payments.

**Dashboard tile**: Compliance expiring in 30 and 60 days (admin).

## 6. Guardrails against the status risk

- The system warns when an engagement has no current status check, or one is overdue for review.
- A new allocation is flagged if the sub-contractor has no CIS verification, no insurance or no status check on record. It does not block it.
- Allocations carry dates, place and scope of work, not working hours or instructions on how to do the work.
- A flag is raised on patterns the engagement record can show, for example a day-rate sub-contractor with a single client and no substitution right.
- The record shows facts and dates. It does not record a conclusion that someone is compliant: that is for AGS and its accountant.

## 7. Build order inside People

1. **Suppliers and sub-contractors**: tables, screens, engagement record, workers with logins, documents
2. **Status checks** and the warnings
3. **Employees**: record and documents
4. **Compliance items** and the expiry tile
5. **Leave**
6. **Resource allocations**: with the Jobs module

## 8. Open questions

1. Can the employee (staff role) see sub-contractor engagement and CIS details and supplier records, or director only?
2. Is the one employee also the director? If so, "staff" has no day-to-day use yet.
3. Do sub-contractor workers need to be linked to a named employee as their point of contact on a job?
4. How are sub-contractors paid today (weekly, per job, per application), and should the system produce payment statements?
5. Does the accountant want to review the status-check checklist and the engagement fields before build?
6. Which compliance items are required by AGS's clients and builders on site (CSCS, public liability levels and so on)?

## 9. Onboarding, contracts and Settings (added 25 Oct 2026)

Payroll is run internally. The MD has no service agreement yet, so a draft has been written and stored (below) for a solicitor to review.

**Settings, People & HR** (admin only) holds the reusable wording:
- **Contract templates**: versioned, with `{{merge_fields}}`. Statuses: draft, with solicitor, approved, retired. Editing makes a new draft version; an approved version is never changed in place. Only approved templates may be issued.
- **Job roles**: title, summary, duties, reports to, place of work, hours. A job role fills Schedule 1 of a contract.

**Tables (migration 0010):** `job_roles`, `contract_templates`. Still to come with onboarding: `issued_contracts` (frozen copy of template text, merged values and role at the time, accepted by, accepted on), `onboarding_checklists` and `onboarding_items`.

**Draft in the system:** the Managing Director service agreement, in `docs/contracts/director-service-agreement.md`, with a separate note for the solicitor in `docs/contracts/director-service-agreement.notes.md`. Run `python3 tools/make_contract_migration.py` after editing either to regenerate the migration.

**Open decisions:** MD approval route (sole director or not), whether the MD is both employee and director, pension duties with a single worker, whether National Insurance and bank details are held in the system or only in payroll.
