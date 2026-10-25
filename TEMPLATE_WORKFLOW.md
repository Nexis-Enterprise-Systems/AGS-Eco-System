# Using this as the template for a new client

This repo (`nexis-client-platform`) is the reusable base for every NEXIS client build — not a one-off project. Once the core structure below is genuinely finalised, this becomes a GitHub **Template repository** (Settings → General → "Template repository" checkbox), so starting a new client is "Use this template" → a clean new repo with its own git history, not a fork or a copy-paste.

## Not ready to templatise yet — and that's fine

Before ticking the Template repository box, the parts every client shares — auth/roles/mandatory 2FA, branding hooks, System Settings, Client & Sub-Contractor management, and the rest of what the pricing model marks "Reused from template" — should be stable enough that a new client mostly needs *configuration*, not surgery. Until then, keep building here as normal. This file is the placeholder for the workflow, not a gate on today's work — the point of getting this into GitHub now is simply that it's backed up and versioned while that stabilising happens.

## The workflow, once it's ready

1. GitHub → this repo → "Use this template" → "Create a new repository" → name it for the client (see naming convention below).
2. Clone the new repo locally.
3. Create that client's own Supabase project (the established one-Supabase-project-per-client pattern) and populate `.env.local` from `.env.example`.
4. Re-brand for the client — logo, colours, company name, System Settings defaults. *(Fill in the exact mechanism here once it's decided — how much of this is data-driven vs. needs a code change.)*
5. Deploy — a new Railway project pointed at the new repo; `railway.json` is already written to be reused as-is.
6. Any genuine platform improvement goes back into THIS repo first, then gets pulled into client repos as needed. This repo stays the source of truth for reusable modules; client repos hold that client's own tweaks on top of it.

## Naming convention (proposed — confirm before the first real use)

`nexis-<client-slug>-platform`, e.g. `nexis-ridgeline-platform`. Matches the subdomain-per-client pattern already decided (`companyname.nexissystems.ae`).

## Open questions — fill in as they're settled

- The exact list of "must reconfigure per client" vs. "safe to leave as the template default."
- Whether re-branding is fully data-driven (a System Settings table) or needs any code edits per client.
- Whether/how an improvement made inside a live client repo ever gets folded back into this template.
