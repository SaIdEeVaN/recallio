import assert from "node:assert/strict";
import test from "node:test";
import { evaluate } from "../evaluation/benchmark.mjs";
import { documents } from "../evaluation/fixtures.mjs";
import { readTutorStream } from "../lib/stream.mjs";

test("the benchmark stops on Gateway denial and counts unattempted cases", async () => {
  let requests = 0;
  const report = await evaluate({
    mode: "gateway",
    model: "test",
    selected: documents.slice(0, 5),
    gatewayCall: async () => {
      requests++;
      throw Object.assign(new Error("Internal provider details"), {
        status: 403,
      });
    },
  });
  assert.equal(requests, 1);
  assert.equal(report.failed, 1);
  assert.equal(report.skipped, 15);
  assert.equal(report.stopped, "Gateway returned HTTP 403");
  assert.equal(report.outcomes[0].error, "HTTP 403");
});

test("the benchmark distinguishes unsupported answers, paraphrases and invented evidence", async () => {
  let requests = 0;
  const report = await evaluate({
    mode: "gateway",
    model: "test",
    selected: documents.slice(0, 1),
    gatewayCall: async (_instruction, input, _tokens, _signal, stream) => {
      const section = input.sections[0];
      const raw = {
        supported: true,
        evidence: [{ ref: section.id, quote: section.text.split("\n\n")[1] }],
        answer: "A pressure disturbance moving along its direction of travel.",
      };
      if (requests++ === 2) raw.evidence[0].quote = "An invented excerpt";
      const event = JSON.stringify({
        choices: [{ delta: { content: JSON.stringify(raw) } }],
      });
      return readTutorStream(
        new Response("data: " + event + "\n\ndata: [DONE]\n\n").body,
        stream.evidence,
        stream.emit,
      );
    },
  });
  assert.deepEqual(
    report.outcomes.map((result) => result.status),
    ["review", "fail", "fail"],
  );
  assert.equal(report.outcomes[0].checks.evidenceContainsAnchor, true);
  assert.equal(report.outcomes[0].checks.answerContainsAnchor, false);
  assert.match(report.outcomes[2].error, /cited evidence/);
});
