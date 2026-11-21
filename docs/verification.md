# Release verification

| Check | Observed result |
|---|---|
| Source and grading suite | Passed normalization, overlap, size limits, PDF extraction and empty-PDF rejection, schema and citation validation, missing answers, interrupted streams, and 3,125 combinations of quiz answers. |
| Browser sample | Passed flashcard editing and persistence, review queue, quiz scoring, retry missed, tutor citations and keyboard-accessible dialogs. |
| Responsive layout and accessibility | Passed the 360 px horizontal overflow check. Automated axe scans of the desk and sample summary reported no violations for the tested WCAG A/AA rules. Manual screen-reader testing is pending. |
| Private integration | Two disposable users authenticated via email magic links in an isolated local Supabase Auth and Postgres environment. A learner created a source, generated all three artifacts using a deterministic model fixture, reviewed cards, submitted a quiz, opened a streamed tutor citation, refreshed, and deleted the set. A second user could not open the first user's set. |
| Storage policies | A rollback-only Postgres test checked the reserved object path, owner reads and deletes, and denial of cross-user reads and deletes. The parser was exercised with a two-page PDF fixture. Signed upload and download through the hosted Storage API are pending an authenticated production account. |
| Production authorization | Anonymous requests to list, open, generate and delete private study sets all returned HTTP 401. |
| Dependency review | npm reported zero known production dependency vulnerabilities at the time of the run. |

## Model evaluation

Run the benchmark without credentials using `npm run eval`. It checks 120 tutor cases across 40 synthetic study documents plus eight five-question quizzes. It exercises the app's production prompt builder, tutor stream parser, citation validation, quiz answer redaction and grader. The fixture run recorded 128 passes, including 45 expected abstentions. GitHub Actions runs this check on every push to `main`.

Gateway mode sends the same synthetic inputs and production prompts to the configured model. Run `npm run eval -- --gateway --documents 5` to start with 15 tutor cases and one quiz. Increase the document count to 40 for the complete corpus. Each tutor case makes one request and each quiz allows one retry, so the full run makes at most 136 requests. It stops early on authentication, credits, permission or rate-limit errors. Gateway mode uses `AI_GATEWAY_API_KEY` or Vercel workload credentials and can consume credits.

To save the per-case results with cited text, use `npm run --silent eval -- --gateway --documents 5 --json > report.json`. A passage or answer that paraphrases an expected phrase can be flagged for review. A response that quotes a matching phrase still needs human review of claim support. The command exits nonzero if any case fails, needs review or was skipped.

For the human review, score each response as supported, unsupported, or appropriately abstained. Verify that each material claim follows from the cited excerpt. Record ambiguous cases and do not count an ID match alone as groundedness. For quizzes, check that exactly one option is defensible and the explanation supports it. Record the model and prompt revision, sample size, pass counts, and any exclusions before reporting percentages.

A trusted environment with Gateway credentials can run `node evaluation/gateway-smoke.mjs` for a single synthetic provider check. Real-user latency percentiles, private upload tests on the production host, public email delivery and the human-reviewed groundedness target remain separate release checks.

The Vercel production build obtained a workload credential, then received HTTP 403 from AI Gateway with a credits-related message for both `openai/gpt-4.1-mini` and `reflection/beam-free`. Public account verification also requires configuring the hosted Supabase project’s Site URL and an SMTP sender.
