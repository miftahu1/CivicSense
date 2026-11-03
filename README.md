# CivicSense

**Campus problems understood. Actions made visible.**

CivicSense is a bilingual campus issue reporting and response platform. Students can report in English, Assamese, Romanised Assamese, or mixed language; campus staff work issues assigned to their departments; administrators coordinate work, review outcomes, and confirm issue clusters. Reports preserve the original wording while AI assists with translation, triage, and cross-language matching.

The app uses authenticated Supabase accounts and server-side role checks. There is no local-storage or synthetic-report fallback in the production workspace.

## Product features

- **Student workspace:** overview, report submission, report history, activity, and campus services.
- **Two report flows:** a standard text-first form with an optional photo, or an image-first flow where Gemini drafts a description/category/priority for the reporter to review. The reporter confirms before anything is submitted; if they leave the AI description and category unchanged, the app reuses the image triage rather than repeating report analysis.
- **Optional live location:** the reporter can ask the browser for a one-time GPS pin in either form. Permission is requested only after the user clicks. The app stores coordinates and the browser’s accuracy estimate with the report; it does not continuously track the user. The pin is available only in authorized report details and is excluded from public issues and related-report previews. Browser geolocation requires HTTPS or localhost.
- **Bilingual AI triage:** Gemini detects the source language, keeps original text, and creates English and Assamese summaries with suggested category, priority, department, and explanation. Image analysis is a separate step from report analysis.
- **Cross-language issue intelligence:** Gemini Embedding 2 vectors and Postgres/pgvector identify similar unresolved reports, including across English, Assamese, and Romanised Assamese. Administrators review suggestions and confirm clusters. Staff see confirmed unresolved clusters for their department; students see confirmed matches with privacy filtering.
- **Staff workflow:** staff see their assigned department’s queue, update work state and notes, and send completed work to an administrator for review. Administrators approve completion or return the issue for more work.
- **Administrator workspace:** issue desk and assignments, team/department access, cluster review, analytics, activity, abuse review, public-board controls, and AI diagnostics.
- **Public issue board:** `/issues` is controlled by an administrator. When enabled, the public navigation link appears; when disabled, the board routes are unavailable. Reporters can opt out individual reports. Sensitive and synthetic reports are excluded. Public output uses a limited projection and never includes original wording, reporter identity, photos, or live coordinates.
- **High-priority email alerts:** EmailJS can notify staff assigned to the corresponding department when a non-sensitive report is High or Urgent. The message includes an authenticated link to the exact report.
- **Abuse controls:** request limits and review signals cover rapid submissions, repeated report text, and suspicious links paired with payment or credential requests. Administrators can investigate, restrict, and unblock accounts or IP fingerprints.
- **Password recovery:** email-based reset flow at `/forgot-password` and `/reset-password`.
- **Responsive bilingual interface:** English/Assamese UI, accessible report dialogs, responsive workspaces, and clear status timelines.

## Technology

- **Application:** Next.js 16 App Router, React 19, TypeScript 5.9.
- **Authentication and data:** Supabase Auth, PostgreSQL, Row Level Security, Supabase Storage, and Postgres functions. Server routes use the service-role key only after checking the user session and role.
- **AI:** Google Gemini through `@google/genai`; Gemini Embedding 2 with pgvector for similarity search; Zod schemas validate AI and request data.
- **Email:** EmailJS server API for department alerts.
- **UI:** CSS with Tailwind CSS 4 tooling, Geist and Noto Sans Bengali fonts, Lucide icons, Recharts, and Sonner notifications.
- **Quality tools:** ESLint and TypeScript; `tsx` scripts for matching evaluation and local diagnostics.

## Local setup

Requirements: Node.js 20.9 or newer and npm.

1. Install packages: `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the values. Keep server secrets out of `NEXT_PUBLIC_` variables and out of source control.
3. For a fresh Supabase project, apply SQL files in `supabase/migrations` in filename order. For an existing project, apply only migrations that have not already been applied. The latest `202611030005_report_live_location.sql` adds optional coordinate fields.
4. In Supabase Auth, configure the local Site URL and redirect URLs. For production, configure the production URL, email confirmation, and a deliverable SMTP sender.
5. Start the app with `npm run dev`, then open `http://localhost:3000`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser-safe Supabase publishable/anon key for session-based auth. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only privileged Supabase access. Never expose it to the browser. |
| `GEMINI_API_KEY` | Yes for AI | Server-side key for the primary Google account. |
| `BACKUP_GEMINI_API_KEY` | Optional | Key for a second Google account. Admin diagnostics can select which account is preferred. |
| `GEMINI_MODEL` | Optional | Primary model; defaults to `gemini-3.6-flash`. |
| `GEMINI_FALLBACK_MODEL` | Optional | Same-account fallback; defaults to `gemini-3.5-flash-lite`. |
| `GEMINI_EMBEDDING_MODEL` | Optional | Embedding model; defaults to `gemini-embedding-2`. |
| `SIMILARITY_THRESHOLD` | Optional | Semantic match threshold; defaults to `0.82`. Tune against reviewed campus examples. |
| `EMAILJS_SERVICE_ID` | Optional | EmailJS service used for department alerts. |
| `EMAILJS_PUBLIC_KEY` | Optional | EmailJS account public key. |
| `EMAILJS_PRIVATE_KEY` | Optional | Server-only EmailJS private key for sending from the backend. |
| `EMAILJS_DEPARTMENT_ALERT_TEMPLATE_ID` | Optional | Dynamic EmailJS template for High/Urgent department alerts. |
| `NEXT_PUBLIC_APP_URL` | Recommended | Canonical app URL used to build report links in email notifications. |
| `ABUSE_IP_HASH_SECRET` | Optional | Stable server-only HMAC secret for abuse fingerprints; otherwise the service-role key is used. |
| `CIVICSENSE_CLIENT_IP_HEADER` | Optional | Trusted proxy-injected client IP header if the hosting provider is not detected automatically. |

`.env.local` is ignored by Git; `.env.example` contains placeholders only. Never commit real API keys, passwords, or service-role credentials.

## Accounts and roles

- New registrations at `/signup` receive the student role. Existing authenticated users without a profile are safely provisioned as students.
- Promote the first verified campus operations account in the Supabase SQL Editor. Replace the email with the exact verified account and check that one profile was updated:

  ```sql
  update public.profiles
  set role = 'admin'
  where id = (
    select id from auth.users
    where lower(email) = lower('operations@example.edu')
      and email_confirmed_at is not null
  );
  ```

- Administrators grant staff access and assign a campus department in **Team access**. Department assignment determines staff queue access and report routing.
- Every authenticated API route verifies the Supabase session and stored role on the server. Students can access their own reports; staff can access reports assigned to their department; administrators can review campus reports. Public APIs expose only explicitly selected public fields.

## Report and AI workflow

1. The report API validates the submission, checks abuse limits, and saves the original report first. Optional image attachments are validated and stored in the private `report-attachments` bucket (JPEG, PNG, WebP, or HEIC; up to 15 MB). Optional live coordinates are stored alongside the report after browser permission is granted.
2. Gemini analyzes the text and optional photo, then stores source-language detection, bilingual summaries, suggested category/priority/department, confidence, and image description. AI calls are server-side and use structured output validation.
3. Model calls try the selected API key’s primary model, then its fallback model. If both fail and a second key is configured, the app tries the primary model with the other account. Embeddings use the configured embedding model. Admin **AI diagnostics** reports the actual model used, timings, responses, and copied execution logs; the admin can switch the preferred API key.
4. Semantic search checks unresolved non-synthetic issues. Similarity suggestions are not automatically merged: an administrator confirms cluster membership. Staff and students only see confirmed connections, with role-appropriate privacy filtering.
5. Staff document their work and submit completion for administrator review. Only an administrator can resolve a report.

AI output is a triage aid; campus staff make final decisions. Validate Assamese, especially native-script Assamese and Romanised Assamese, with fluent speakers before relying on classifications or similarity scores.

## Abuse protection and privacy

Authenticated accounts are limited to 10 reports per rolling hour and 4 per 10 minutes. Image draft analysis is limited to 5 requests per 10 minutes. A trusted network exceeding 60 report or image-analysis requests in 10 minutes can receive a 15-minute IP cooldown. Repeated content and suspicious solicitation create review signals; they are not automatic fraud verdicts. IPs are stored as HMAC fingerprints rather than readable addresses. Administrators can review signals, restrict accounts/IPs, add investigation notes, and lift restrictions.

For IP controls in production, requests must pass through a trusted proxy that supplies a verified client-IP header. Vercel, Cloudflare, and Netlify headers are recognized; configure `CIVICSENSE_CLIENT_IP_HEADER` only for a trusted host-provided header, never a client-controlled value. Set a stable random `ABUSE_IP_HASH_SECRET` in encrypted deployment settings if fingerprints should remain stable when rotating the Supabase service key.

Live location is optional and one-shot. The app asks the browser only after the user chooses **Use my current location**; it does not run a location watcher. Coordinates are available only on authorized report detail views and are not sent to Gemini or exposed to the public issue board.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the local Next.js development server. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Run TypeScript without emitting files. |
| `npm run build` | Create a production build. |
| `npm run start` | Serve the production build. |
| `npm run eval:matching` | Evaluate the prepared semantic matching examples using `.env.local`. |
| `npm run test:local` | Run the local API/AI diagnostic script using `.env.local`. |

## Main routes

- **Public:** `/`, `/how-it-works`, `/issues`, `/issues/[ticketNumber]`.
- **Authentication:** `/login`, `/signup`, `/forgot-password`, `/reset-password`.
- **Student workspace:** `/app`, `/app/new`, `/app/reports`, `/app/reports/[id]`, `/app/activity`, `/app/campus-services`.
- **Staff workspace:** `/staff`, report submission, and authorized report details.
- **Administrator workspace:** `/admin`, `/admin/issues`, `/admin/clusters`, `/admin/team`, `/admin/abuse`, `/admin/diagnostics`, `/admin/insights`, `/admin/activity`.
- **API:** authenticated report, staff, and admin endpoints live under `/api`; public issue endpoints live under `/api/public/issues`.

## Deployment

1. Import the repository into a Node.js host that supports Next.js (for example, Vercel).
2. Configure the environment variables in the host’s encrypted settings for the correct environment.
3. Apply only unapplied Supabase migrations in filename order, including the latest migration before enabling live location.
4. Configure Supabase Auth URLs, email confirmation, SMTP, private storage, and database policies/functions from the migrations.
5. Promote the first verified administrator, assign staff departments, and configure EmailJS templates if department alerts are wanted.
6. Run lint, typecheck, and build before deploying.
