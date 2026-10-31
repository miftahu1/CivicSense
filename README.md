# CivicSense

**Campus problems understood. Actions made visible.**

CivicSense is a bilingual campus issue reporting and operations workspace for Dibrugarh University. Students and staff can report issues in Assamese, Romanised Assamese, English, or mixed language. The English/Assamese interface preference applies across the landing page, authentication screens, student workspace, and administration screens. Campus administrators review the original submission, AI summaries and triage, possible related reports, assignments, and status history.

The repository is a fresh Next.js App Router application. It includes a browser-only synthetic walkthrough so the interface can be explored before connecting external services. The walkthrough is not an authentication or persistence substitute: its changes live in local browser storage. Configure Supabase and Gemini for private accounts, durable PostgreSQL reports, protected photo storage, live analysis, and cross-language semantic search.

## Local development

Requirements: Node.js 20.9 or newer and npm.

1. Install packages: `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase and Gemini values below.
3. Create a Supabase project. In its SQL Editor, run the files in `supabase/migrations` in filename order. The first migration creates the schema; the follow-up migration adds investigation status, department assignment, and the 15 MB photo limit.
4. Start the app: `npm run dev`
5. Open `http://localhost:3000`.

The landing page opens the synthetic workspace through **Open workspace**. Use the role selector at the top of a workspace page to switch between synthetic student, staff, and administrator views. Sample reports are fictional and are labeled synthetic in the dashboard, report lists, and seeded database rows.

## Environment variables

| Variable | Where to find it | Used for |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project API settings | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project API settings | Browser sign-in and cookie-backed session |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project API settings | Server-only report operations, private storage, seeding |
| `GEMINI_API_KEY` | Google AI Studio | Server-side analysis and embeddings |
| `GEMINI_MODEL` | Optional | Defaults to `gemini-3.8-flash` |
| `GEMINI_EMBEDDING_MODEL` | Optional | Defaults to `gemini-embedding-2` |
| `SIMILARITY_THRESHOLD` | Optional | Defaults to the experimental value `0.82` |
| `DEMO_PASSWORD` | Set locally before seeding | Shared password created for the three synthetic demo accounts; use 12 or more characters |

Never put `SUPABASE_SERVICE_ROLE_KEY` or `GEMINI_API_KEY` in a `NEXT_PUBLIC_` variable. They are read only by server routes and the seeding/evaluation scripts.

## Authentication and roles

- Register students and staff from `/signup`; Supabase Auth stores credentials and a database trigger creates their profile.
- Self-registration is limited to student and staff roles. The trigger ignores any requested administrator role.
- To promote an existing account, run this statement as a trusted project owner in the Supabase SQL Editor, replacing the email:

  ```sql
  update public.profiles
  set role = 'admin'
  where id = (select id from auth.users where email = 'operations@example.edu');
  ```

- In production, enable email confirmation and configure an SMTP sender in Supabase Auth. For a local hackathon walkthrough, the project can disable confirmation in its Supabase Auth settings.
- Every route checks the Supabase user on the server. Administrator endpoints also read the profile role on the server. Students can read only their own reports. The service-role key is never sent to a browser.

## Synthetic demo accounts and records

Set `DEMO_PASSWORD` in `.env.local`, then run:

```bash
npm run seed:demo
```

The script creates or updates these confirmed synthetic accounts and seeds the bilingual campus reports, two manually confirmed cross-language clusters, and status events:

- `student@civicsense.demo` — student
- `staff@civicsense.demo` — university staff
- `admin@civicsense.demo` — administrator

All three use the local `DEMO_PASSWORD`. Seeded rows set `is_synthetic = true`; event messages also identify the synthetic walkthrough. If `GEMINI_API_KEY` is set, the script additionally generates and saves 768-dimensional embeddings for the seed reports. Without it, it still seeds the synthetic records and reports that semantic vectors were skipped. This is fictional demonstration data, not Dibrugarh University complaint data.

## AI and semantic matching

`POST /api/reports` validates a multipart report, saves the original text and location first, then stores an optional photo up to 15 MB in the private `report-attachments` bucket. Gemini 3.8 Flash receives the original text, the reported language, the campus location, and—when supplied—the image. Its structured JSON includes detected language, category, suggested priority and explanation, bilingual title and summary, department, visible image description, confidence, and sensitive-content flag; Zod validates that result before it is saved. An administrator can override category, priority, status, and assignment to a department and field team.

Gemini Embedding 2 embeds the original report text with building and area context. The database stores exactly 768 dimensions in pgvector. The `match_reports` SQL function searches unresolved reports, applies the configurable initial threshold, adds a small same-building relevance adjustment, and returns at most three suggestions. A similarity suggestion includes a plain-language reason. Administrators must confirm a relationship to create a cluster; grouping never deletes or replaces original reports. When Gemini or photo analysis fails, the already saved report remains in an analysis-failed state and an administrator can retry.

Six prepared evaluation inputs (three Assamese, including Romanised Assamese, and three English) live in `test-data/assamese-matching-cases.ts`. With `GEMINI_API_KEY` configured, run:

```bash
npm run eval:matching
```

The script prints cosine similarities and checks three expected cross-language positives plus three unrelated pairs against the current threshold. Treat the threshold as experimental and review the printed scores with native Assamese speakers before relying on suggestions. It is not safe to infer final threshold quality without running this script against the configured model.

## API routes

The Next.js Route Handlers cover:

- `POST /api/reports` and `GET /api/reports`
- `GET /api/reports/[id]` and `GET /api/reports/[id]/similar`
- `GET /api/admin/queue` and `GET /api/admin/metrics`
- `PATCH /api/admin/reports/[id]`, `POST /api/admin/reports/[id]/assign`, and `POST /api/admin/reports/[id]/analyze`
- `GET|POST /api/admin/clusters` and `PATCH /api/admin/clusters/[id]`

The workspace polls the authenticated report endpoint every 30 seconds for status updates. Report events provide the in-app status history and notification content.

## Database, storage, and privacy

The migrations create profiles, reports, attachments, issue clusters, report events, and 768-dimensional report embeddings. They add query indexes, timestamps, the private photo bucket, RLS policies, service-only vector RPCs, investigation status, department assignment, and the 15 MB attachment limit. Students can select their own reports and related status history. Administrators can select all authorised reports and clusters. Writes that affect reports and clusters are performed after server-side role checks.

## Deploy to Vercel

1. Push this repository to a Git provider and import it into Vercel.
2. Add the Supabase URL, anon key, service-role key, and Gemini API key to the Vercel project environment settings. Optionally set the model IDs and similarity threshold.
3. Apply the SQL migration to the production Supabase project.
4. Set the correct production Site URL and redirect URLs under Supabase Auth settings, and enable email confirmation/SMTP for public accounts.
5. Deploy. `npm run build` is the production build command; Vercel detects Next.js automatically.

## Quality checks

Run `npm run lint`, `npm run typecheck`, and `npm run build`. Run `npm run eval:matching` after configuring Gemini to assess the Assamese, Romanised Assamese, and English embedding pairs.
