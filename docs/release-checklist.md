# Recallio release checklist

## Local checks

Use Node 24, the same version used by GitHub Actions. Run these commands from the repository root. The loopback settings match CI and let Playwright exercise mocked sign-in without connecting to a hosted Supabase project.

```bash
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-test-only
export RECALLIO_SERVER_KEY=local-ci-no-database

npm ci
npm run verify
npx playwright install chromium
npm run e2e
```

If Chromium is already installed, set `CHROMIUM_PATH` to its executable and skip the browser installation. Playwright starts the local production build automatically. Set `TEST_URL` to use a local test server that is already running. Run these checks in a separate shell from any private integration stack so the fixture variables do not override its settings.

For changes to private study data, authentication, or generation, run the [local private integration checks](../README.md#verification-and-releases) with Supabase, Mailpit, and the deterministic Gateway fixture. Consult the [verification report](verification.md) for prior results and the review criteria for real model outputs.

## Hosted setup

- **Supabase database.** Confirm that all repository migrations are applied to the intended project and that its server-key digest matches the server-only value configured in Vercel. See [local setup](../README.md#run-locally) for the configuration SQL.
- **Sign-in.** Set the Supabase Site URL and allowed redirects to the deployment origins. Configure custom SMTP and verify a magic link reaches an account outside the Supabase project team. If Google is enabled, verify sign-in with an account in the configured OAuth audience. See [Google sign-in setup](../README.md#google-sign-in).
- **Vercel.** Use the Next.js preset and confirm the production environment variables are set before building from `main`. Rebuild after changing either `NEXT_PUBLIC_SUPABASE_*` setting because Next.js embeds them in the client build.
- **AI Gateway.** Confirm the Vercel team has credit and access to the configured model. Run the [small Gateway evaluation](verification.md#model-evaluation), then review citations and abstentions. The fixture benchmark runs independently of Gateway access.

## Production smoke checks

1. Confirm that the production alias is serving the expected `main` commit. Open **Explore sample** and verify a citation, flashcard, and quiz.
2. Sign in with a disposable test account. Create a set from synthetic text, generate the study tools, submit a quiz, and open a tutor citation. Refresh and confirm that the set and completed attempt are still available.
3. Upload a small text-based PDF or UTF-8 TXT. Confirm the original can be opened by its owner, and confirm a second signed-in test account cannot open the set. Delete the test sets after verification.
4. Record the deployed commit, model, and smoke-test results. If the deployment must be rolled back, promote the previous known-good Vercel deployment. Handle any incompatible database changes with a forward migration.
