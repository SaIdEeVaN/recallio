# Release verification

| Check | Observed result |
|---|---|
| Source and grading suite | Passed normalization, overlap, size limits, PDF extraction and empty-PDF rejection, schema and citation validation, missing answers, interrupted streams, and 3,125 combinations of quiz answers. |
| Browser sample | Passed flashcard editing and persistence, review queue, quiz scoring, retry missed, tutor citations and keyboard-accessible dialogs. |
| Responsive layout and accessibility | Passed the 360 px horizontal overflow check. Automated axe scans of the desk and sample summary reported no violations for the tested WCAG A/AA rules. Manual screen-reader testing is pending. |
| Private integration | Two disposable users authenticated via email magic links in an isolated local Supabase Auth and Postgres environment. A learner created a source, generated all three artifacts using a deterministic model fixture, reviewed cards, submitted a quiz, opened a streamed tutor citation, refreshed, and deleted the set. A second user could not open the first user's set. |
| Dependency review | npm reported zero known production dependency vulnerabilities at the time of the run. |

## Model evaluation

The synthetic corpus contains 40 study documents and 120 proposed review prompts. It includes unsupported questions, contradictory annotations and embedded instructions. Automated fixture checks verify that expected supporting phrases exist in the source. These checks measure the test data. Model quality still requires actual model responses and independent human review.

For the human review, score each response as supported, unsupported, or appropriately abstained. Verify that each material claim follows from the cited excerpt. Record ambiguous cases and do not count an ID match alone as groundedness. For quizzes, check that exactly one option is defensible and the explanation supports it. Record the model and prompt revision, sample size, pass counts, and any exclusions before reporting percentages.

A trusted environment with Gateway credentials can run `node evaluation/gateway-smoke.mjs` for a single synthetic provider check. Real-user latency percentiles, private upload tests on the production host, public email delivery and the human-reviewed groundedness target remain separate release checks.
