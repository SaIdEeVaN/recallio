# Recallio

Recallio turns one source into a private study set. Read a cited summary, review flashcards, take a server-graded quiz, or ask questions that link back to supporting passages.

**[Open Recallio](https://recallio-sai.vercel.app)** · **[Release checklist](docs/release-checklist.md)** · **[Verification report](docs/verification.md)**

![Recallio study desk with the interactive photosynthesis sample](docs/study-desk.webp)

## Try it

1. Choose **Explore sample**. Open a citation in the summary to jump to the original passage.
2. Flip a flashcard and choose **Review again**. The card appears in the review queue.
3. Take a quiz, submit your answers, and retry missed questions. Unanswered questions appear separately. Accuracy uses the number answered.
4. Sign in by email or with Google, when enabled, to save your own sources. Choose **New study set**, paste notes or upload a text-based PDF or TXT, review the extraction, then choose **Generate tools**.

Sample practice stays in the browser. Private sets and completed attempts persist in Supabase. The sample tutor has three curated answers. The private tutor calls a configurable model through Vercel AI Gateway.

## Architecture

```mermaid
flowchart LR
  Learner[Browser] --> Auth[Supabase Auth]
  Learner --> API[Next.js on Vercel]
  Learner -->|Signed upload| Files[Private Supabase Storage]
  API -->|Verified identity and RLS| DB[(Supabase Postgres)]
  API --> Files
  API -->|Bounded worker| PDF[PDF text extraction]
  API -->|Selected source passages| Model[Vercel AI Gateway]
  Model -->|Validated outputs and citations| API
```

Private APIs require a Supabase user token. Postgres applies owner policies and checks a server-only secret for study data. The browser receives the answer key only for a submitted quiz or a question it has locked in immediate-feedback mode. Attempts snapshot the questions so later edits preserve historical scores.

TXT must contain UTF-8 text. The default limits are 30,000 pasted characters, 5 MB per upload, 100 pages and 100,000 extracted characters. PDF parsing runs in a separate worker with a memory limit and a 20-second deadline. Originals use signed upload URLs, which also accommodate files above Vercel's request-body limit.

Long sources are processed in groups before aggregation. The tutor uses full-text ranking for longer sources. Approved citations reference stored chunk IDs, and tutor quotations must match the cited text. Generation uses bounded retries, a 20-call daily account allowance, a 5-upload allowance, IP quotas and a shared daily call ceiling. These limits reset at midnight UTC.

## Run locally

Use Node 24, npm and a Supabase project or the local Supabase CLI stack.

1. Run `npm ci`. Copy `.env.example` to `.env.local`. Set the Supabase URL and publishable key.
2. Apply the SQL files in `supabase/migrations/` in timestamp order to the intended database. The Supabase CLI can also apply them with `supabase db push` after linking the project.
3. Generate a 32-byte random hexadecimal value for `RECALLIO_SERVER_KEY` and store it only in your host's secret manager or ignored local environment. Compute its SHA-256 digest locally. Store the digest in the database using the following SQL with your hexadecimal digest substituted.
4. Enable Supabase email sign-in. Set **Authentication → URL Configuration → Site URL** to your app origin. Allow your additional development URLs. Configure a custom SMTP sender to deliver magic links to users outside your Supabase project team.
5. Set `AI_GATEWAY_API_KEY` locally or use Vercel workload OIDC in production. The default model is `openai/gpt-4.1-mini`. Gateway credits and model availability belong to the hosting account. The account owner controls provider billing and alerts.
6. Run `npm run dev` and open the displayed URL.

```sql
insert into recallio_private.configuration(name,value)
values ('server_hash','<64-character SHA-256 hex digest>')
on conflict(name) do update set value=excluded.value;
```

| Environment variable | Purpose |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase project endpoint |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Public Auth/API key |
| RECALLIO_SERVER_KEY | Secret backend credential matching the stored digest |
| AI_GATEWAY_API_KEY | Optional server-side Gateway key for environments without Vercel OIDC |
| RECALLIO_MODEL | Gateway model ID |
| RECALLIO_AI_ENABLED | Set to `false` to pause generation and tutoring |
| RECALLIO_UPLOAD_ENABLED | Set to `false` to pause file upload reservations |

## Google sign-in

Recallio reads the Supabase provider settings when the sign-in dialog opens. The Google button appears as soon as Google is enabled for the project. OAuth configuration lives in Google Auth Platform and Supabase.

1. Set the Supabase **Authentication → URL Configuration → Site URL** to `https://recallio-sai.vercel.app`. Add exact development origins to the redirect allow list as needed.
2. In [Google Auth Platform](https://console.cloud.google.com/auth/overview), configure the consent screen and its audience. An external app in Testing mode only supports its configured test users. Use the standard OpenID, email and profile scopes.
3. Create a **Web application** OAuth client. Set its authorized JavaScript origin to `https://recallio-sai.vercel.app` and its authorized redirect URI to `https://mnrnauoxiuycmvxwzzte.supabase.co/auth/v1/callback`. For your own copy of Recallio, use your application origin and the callback URI displayed in the Google provider settings of your Supabase project.
4. Enter the Google Client ID and Client Secret in the [Supabase Google provider settings](https://supabase.com/dashboard/project/mnrnauoxiuycmvxwzzte/auth/providers?provider=Google), then enable and save the provider. Keep the Client Secret in Supabase.
5. Open Recallio, choose **Continue with Google**, then verify you can open **Account** and save a study set.

[Supabase’s Google sign-in guide](https://supabase.com/docs/guides/auth/social-login/auth-google)

## Verification and releases

Run `npm run verify` for formatting, linting, type checking, unit tests, the fixture benchmark, the production dependency audit, and the production build. The browser checks and hosted account, model, and upload steps are in the [release checklist](docs/release-checklist.md).

Run `npm run eval` for the full fixture benchmark. The [verification report](docs/verification.md#model-evaluation) documents the opt-in Gateway run and how to review its results.

The private integration runner uses an isolated local Supabase stack and its captured test inbox. Allow the local app origin in Supabase, apply the migrations and configure the server secret. Run `node tests/mock-gateway.mjs`, set `RECALLIO_TEST_GATEWAY=http://127.0.0.1:3196/model` and a fixture-only `AI_GATEWAY_API_KEY` in your local development process, then start the app on port 3191. Run `npm run test:private` with `TEST_INBOX_URL` pointing to the local Mailpit HTTP origin. Production always uses Vercel AI Gateway.

Commit and release from **main**. Select the Next.js preset on Vercel and configure production variables before building. Verify the production alias and commit SHA after deployment. To roll back, promote the previous known-good Vercel production deployment. Apply compatible forward migrations if a database correction is needed.

## Data controls

Deleting a set removes its live original and derived data. Account requests are recorded in `public.account_deletion_requests` for a project owner to fulfill. Verify the request, remove any remaining private Storage objects owned by the user, then remove the user via Supabase Auth. Foreign keys remove their study sets, jobs and request. Operational usage counters expire after 31 days of activity. The free deployment has no application-managed backup copies. Provider retention is governed by its service terms.

Model calls send relevant private excerpts to the configured provider. Logs contain status, timing and token counts. See [Supabase backup policy](https://supabase.com/docs/guides/platform/backups), [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) and [OpenAI data controls](https://platform.openai.com/docs/guides/your-data).
