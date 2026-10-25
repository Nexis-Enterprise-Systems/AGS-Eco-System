# Prompt: current-system handover document

Paste everything below the line into a coding session opened on the CURRENT AGS system. It should produce one file, `AGS_CURRENT_SYSTEM_HANDOVER.md`, which you then upload to the AGS project in Claude so the new Eco System is built from facts, not memory.

---

You are documenting this codebase so a different team can rebuild and improve it on a new stack (Vite + React + TypeScript + Tailwind, Supabase Postgres/Auth/Storage, Railway). Read the code; do not guess. Where something is unclear, say so. Do not print secrets: list environment variable NAMES only.

Write ONE markdown file called `AGS_CURRENT_SYSTEM_HANDOVER.md` with these sections:

1. **Purpose and users** – what the system does, who uses it, how they log in.
2. **Tech stack and hosting** – languages, frameworks, database, hosting, domains, third-party services, environment variable names.
3. **Data model** – every table or collection: fields, types, relationships, and what each field is used for. Include a simple relationship list (A has many B).
4. **Roles and permissions** – every role and exactly what each can see and do.
5. **Features** – for each feature: what it does, where it lives (route/file), and its workflow step by step (e.g. enquiry → quote → job → WIP → invoice).
6. **Documents and outputs** – every generated document or email (quotes, WIP, job cards, invoices, notifications): template, trigger, data used, recipients.
7. **Integrations** – accounting, email, calendar, storage, payments, anything else: how each connects and what data moves.
8. **Screens and navigation** – list of every screen/route and its purpose.
9. **Business rules** – calculations, statuses, numbering schemes, pricing/markup logic, approvals, validation.
10. **Known problems** – bugs, workarounds, things staff complain about, missing features, performance or security concerns.
11. **Data to migrate** – what existing data matters, its volume, its format, and any cleanup needed.
12. **Keep / change / drop** – your recommendation for each feature, with a one-line reason.

Keep it factual and complete. Put short code or schema excerpts in where they remove ambiguity.
