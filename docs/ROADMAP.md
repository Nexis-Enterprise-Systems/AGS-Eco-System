# AGS Eco System: Roadmap

Last updated 2026-10-25. Generated from `src/roadmap/modules.json`; edit that file, then run `python3 tools/make_roadmap_md.py`.

**8 built, 3 in progress, 25 planned (36 modules).**

## Foundation

The base every other module stands on. Inherited from the NEXIS client platform and re-themed for AGS.

| Module | Status | What it covers | Depends on |
| --- | --- | --- | --- |
| Sign-in and mandatory 2FA | Built | Email and password sign-in; every account must set up an authenticator app, enforced in the database as well as the app. | - |
| Roles and invites | Built | Admin, staff and sub-contractor roles; people sign up from an invite list. | - |
| Business units | Built | Head Office plus optional separate units, each with its own details and branding. | - |
| AGS look and feel | Built | Cormorant Garamond and Jost, AGS colours, dark and light mode, logo from settings, shared page header. | - |
| Interactive dashboard framework | Built | Choose, arrange and resize tiles per person. Tiles arrive with each module. | - |
| Team directory and profiles | Built | Who's who across the system, with contact details shown only where allowed. | - |
| Roadmap | Built | This page: what is built, in progress and planned. | - |

## People

Employees and sub-contractors in one area, with a strict split between HR and compliance.

| Module | Status | What it covers | Depends on |
| --- | --- | --- | --- |
| People data design | In progress | Records, permissions and screens for employees, sub-contractors and suppliers. For review before any code. | - |
| People & HR settings: templates and job roles | In progress | Versioned contract templates and a job roles library in Settings. MD service agreement drafted, awaiting solicitor review. | Roles and invites |
| People onboarding (employees and sub-contractors) | In progress | One process for both: add, invite link, six-step self-service form, typed-name signature, office Accept or Reject, then login via sign-up. Built, with a stored signed PDF, a Compliance tab, a dashboard expiry tile and renewal capture. Reminder emails and the employee contract wording still to come. | People & HR settings: templates and job roles, People data design |
| Suppliers (including agencies) | Planned | Anyone AGS buys from: materials, services, agencies and sub-contractor businesses. One record per business. | People data design |
| Sub-contractors and compliance | Planned | Engagement type, CIS status, insurance, status checks (CEST), contract and workers with logins. | Suppliers (including agencies) |
| Employees (HR) | Planned | Staff records, time away, qualifications and training. Employees only; never applied to sub-contractors. | People data design |
| Compliance tracking and alerts | Planned | Site cards, insurance and certificates with expiry dates, and a dashboard tile for what is expiring. | Sub-contractors and compliance, Employees (HR) |

## Clients, sites and jobs

The core of the work: who it is for, where it is and what stage it is at.

| Module | Status | What it covers | Depends on |
| --- | --- | --- | --- |
| Clients | Built | Client records with bulk import. Template version; to be reworked for AGS (private clients, builders, commercial). | - |
| Sites and map positions | Planned | Addresses with postcode lookup and map positions. | Clients |
| Jobs | Planned | Replaces the template's Projects: stages, dates, scope, value, documents. Includes allocations of people to jobs. | Clients, Sites and map positions, People data design |
| Enquiries and quotes | Planned | Enquiry intake from the website, quoting, conversion to a job. | Clients, Jobs |
| Job map | Planned | Map of jobs by status, sector and team, with a dashboard tile. | Sites and map positions, Jobs |

## Operations

Running the work day to day.

| Module | Status | What it covers | Depends on |
| --- | --- | --- | --- |
| Resource allocations and schedule | Planned | Who is on which job and when, whether employee, sub-contractor or agency worker. Drives the schedule and labour cost. | Jobs, Sub-contractors and compliance, Employees (HR) |
| Job cards and photos | Planned | Sub-contractors log in to see allocated works, with photos and sign-off. | Resource allocations and schedule |
| Health and safety | Planned | RAMS, inductions, incident log. | Jobs, Compliance tracking and alerts |
| WIP documents | Planned | Work-in-progress documents built up as a job moves and sent to the client. | Jobs |

## Finance

Money in, money out and margin. Locked down by role at database level.

| Module | Status | What it covers | Depends on |
| --- | --- | --- | --- |
| Invoices and payments | Planned | Invoices raised, due, paid, retentions and ageing. | Jobs |
| Job costing and margin | Planned | Labour from allocations plus materials, against quoted value. | Resource allocations and schedule, Invoices and payments |
| CIS records | Planned | Verification, deductions and payment statements for sub-contractors. | Sub-contractors and compliance, Job costing and margin |
| Accounting integration | Planned | Sync with the accounting software once chosen. | Invoices and payments |

## Portals and reporting

What clients, builders and the director see.

| Module | Status | What it covers | Depends on |
| --- | --- | --- | --- |
| Reporting | Planned | Standard reports and exports. | Job costing and margin |
| Client and builder portals | Planned | Controlled access for clients and builders to see their jobs and documents. | Jobs, WIP documents |
| Website link | Planned | Shared project records with the AGS website and enquiries flowing in. | Enquiries and quotes, Jobs |

## Hosting and platform

Getting it live and keeping it safe.

| Module | Status | What it covers | Depends on |
| --- | --- | --- | --- |
| AGS test database | Planned | Own Supabase test project. Waiting on the account invoice. Using the NEXIS demo project meanwhile. | - |
| AGS live database | Planned | Separate live project on a paid plan with daily backups, before any real data. | AGS test database |
| Railway deployment | Planned | Test and live environments from one repository. | AGS test database |
| Cloudflare and domain | Planned | DNS, SSL and protection on a subdomain of agsdecoratingservices.co.uk, once IT give DNS access. | Railway deployment |
| Account recovery and backups | Planned | A proper process for lost authenticators and restoring data. | AGS live database |
| Data migration from the current system | Planned | Needs the handover document from the current system first. | AGS live database |
