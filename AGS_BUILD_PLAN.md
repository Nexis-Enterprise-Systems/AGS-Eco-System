# AGS Eco System — Build Plan

Built by NEXIS Enterprise Systems for AGS Decorating & Refurbishment Services, from the `nexis-client-platform` base template (v3 + business units + user profiles, migrations 0001–0007). This build doubles as a NEXIS case study.

## Status
- [x] Project folder created: `ags-eco-system` (copy of the NEXIS template, own folder, own history to come)
- [x] AGS look applied: Cormorant Garamond (headlines) + Jost (body), charcoal/bronze/warm-grey palette, square hairline-bordered cards and buttons
- [x] Migration `0008_ags_branding.sql` sets AGS brand defaults
- [ ] Current-system handover document (see `HANDOVER_PROMPT.md`) — waiting on Aaron
- [ ] Keep / change / new feature list
- [ ] Data model + roles for AGS (jobs, quotes, WIP, job cards, builder/client portals)
- [ ] Dark/light switch (light default, never follows system) — needs the DB-driven theme reworked so dark tokens override
- [ ] GitHub repo `nexis-ags-platform` (NEXIS naming convention) and Supabase project (AGS's own)
- [ ] Railway deploy, then Cloudflare in front
- [ ] Domain/subdomain once IT confirm access to agsdecoratingservices.co.uk

## Brand tokens (from the AGS website `site.css`)
| Token | Light | Dark |
| --- | --- | --- |
| page background | #F4F3F0 | #131517 |
| surface | #FFFFFF | #1B1E21 |
| text | #1B1D1F | #ECEBE7 |
| muted text | #5E6266 | #A0A3A6 |
| hairline | #D9D7D2 | #2E3236 |
| accent (bronze) | #6E5D3F | #C2AE86 |

## New-NEXIS-client process followed
1. Template copied to its own folder (done)
2. Own Supabase project per client (to do — Aaron creates the project, pastes URL + anon key into `.env.local`)
3. Run migrations 0001 → 0008 in order in the Supabase SQL editor
4. Re-brand (done for defaults; logo to add)
5. Railway project from the client repo; `railway.json` reused as is
6. Cloudflare DNS/CDN/WAF once the domain is available
7. Anything reusable goes back into `nexis-client-platform` first

## Hosting plan
- App: Railway (Vite build, `npm run start`)
- Edge: Cloudflare (DNS, SSL, CDN, WAF) on a subdomain of agsdecoratingservices.co.uk, e.g. `system.agsdecoratingservices.co.uk` (name to confirm)
- Until IT confirm DNS access: run on the Railway-provided URL

## Environment note
The cloud workspace cannot reach the npm registry, so `npm install` and `npm run build` run on Aaron's Mac or on Railway. Code is checked here by reading and TypeScript syntax checks only.

## Open questions
- Final subdomain name
- Scope of "Eco System": jobs, quoting, WIP documents, field job cards, client/builder portals, Design Studio data, or all
- Which parts of the current AGS system to keep, change or drop (needs the handover document)
