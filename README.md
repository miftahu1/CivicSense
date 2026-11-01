# CivicSense

**Campus problems understood. Actions made visible.**

CivicSense is a production-backed bilingual campus issue platform for university communities. Students can report in Assamese, Romanised Assamese, English, or mixed language. Campus staff work reports assigned to their department; administrators manage the team, review staff completions, and confirm semantic report clusters. Report originals and private photo attachments remain attached to their source-language submission.

There is no synthetic workspace or local-storage report fallback. Workspace routes require a valid Supabase session, and API routes enforce the stored profile role on the server.

## Local setup

Requirements: Node.js 20.9 or newer and npm.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set the project values.
3. In the Supabase SQL Editor, apply every file in `supabase/migrations` in filename order. This creates the tables, indexes, private photo bucket, access policies, workflow states, report-submission limit function, and backfills profiles for accounts that already existed.
4. In Supabase Auth, configure the local Site URL and callback URLs. Enable email confirmation and configure a deliverable SMTP sender for production.
5. Run `npm run dev` and open `http://localhost:3000`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser sign-in and cookie-backed session. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only access for protected report workflows and private storage. |
| `GEMINI_API_KEY` | Yes | Server-side bilingual analysis and embeddings. |
| `GEMINI_MODEL` | No | Defaults to `gemini-3.8-flash`. |
| `GEMINI_EMBEDDING_MODEL` | No | Defaults to `gemini-embedding-2`. |
| `SIMILARITY_THRESHOLD` | No | Defaults to `0.82`; validate with native Assamese speakers before relying on matches. |

Never expose `SUPABASE_SERVICE_ROLE_KEY` or `GEMINI_API_KEY` in a `NEXT_PUBLIC_` variable or client-side code. `.env.local` is ignored by Git; `.env.example` contains placeholders only.

## Accounts and roles

- New accounts register through `/signup` and are created as students by a database trigger. Existing authenticated accounts without a profile are safely provisioned as students on first sign-in; the profile backfill migration also handles those accounts. In production, confirm accounts through email before signing in.
- Promote the first verified campus operations account to administrator in the Supabase SQL Editor. Replace the address with the exact verified account email and verify that one profile row was updated:

  ```sql
  update public.profiles
  set role = 'admin'
  where id = (
    select id from auth.users
    where lower(email) = lower('operations@example.edu')
      and email_confirmed_at is not null
  );
  ```

- Administrators grant staff access and assign each staff account a department from **Team access**. Staff can update work assigned to their department and submit completion for an administrator decision. Only administrators can resolve reports or manage issue clusters.
- Every API request verifies the Supabase session, then checks the current profile role and department on the server. The service key is never sent to the browser.

## AI analysis and matching

`POST /api/reports` validates and stores the original report before requesting AI analysis. Optional JPEG, PNG, WebP, and HEIC photos are stored in the private `report-attachments` bucket, with a maximum size of 15 MB. Report analysis produces a detected source language, bilingual summaries, suggested category and priority, department, confidence, and visible image description. Zod validates the structured response before it is saved.

Gemini Embedding 2 embeds the original report and campus location into a 768-dimensional vector. The database match function compares unresolved live reports and returns up to three suggestions. Administrators review suggestions before making a cluster. If Gemini is unavailable, the original report remains saved and an administrator can retry analysis. Users see a safe status message; provider and database details stay in server logs.

Authenticated accounts are limited to 10 report submissions per rolling hour. The limit is enforced atomically in Postgres, not in process memory.

Six prepared matching inputs (three Assamese, including Romanised Assamese, and three English) live in `test-data/assamese-matching-cases.ts`. After configuring Gemini, `npm run eval:matching` prints the semantic scores for manual review. The threshold is experimental; the evaluation is not a substitute for native-speaker review.

## Database, storage, and privacy

Migrations create profiles, reports, attachments, issue clusters, status events, and embeddings. They enable row-level security, a private photo bucket, and service-only database functions. Students see their own records, staff see work assigned to their department, and administrators can review all live reports. Records marked synthetic from an earlier walkthrough are excluded from production queues and semantic matching.

The migrations also add an atomic submission throttle. Apply them to each Supabase environment before deploying code that depends on the functions or schema changes. Applying migrations to the production project remains an operator action.

## Deploy

1. Add this repository to your Git provider and import it into Vercel (or another Node.js host that supports Next.js).
2. Set all required environment variables in the hosting provider’s encrypted environment settings for the correct deployment environment.
3. Apply the Supabase migrations in order and configure production Site URL, callback URLs, email confirmation, and SMTP.
4. Promote the first verified administrator account using the SQL above, then grant staff access through **Team access**.
5. Run `npm run lint`, `npm run typecheck`, and `npm run build`; deploy only after all required production environment variables and migrations are in place.

## Routes

- Student: `/app`, `/app/new`, `/app/reports`
- Staff: `/staff`, plus report submission and personal reports
- Administrator: `/admin`, `/admin/issues`, `/admin/clusters`, `/admin/team`
- API: report submission and retrieval, authenticated profile recovery, staff queue and updates, administrator metrics, assignments, analysis retry, team access, and issue clusters under `/api`.
