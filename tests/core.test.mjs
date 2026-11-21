import test from "node:test";
import assert from "node:assert/strict";
import {
  material,
  validate,
  publicQuestions,
  grade,
  retrieve,
  safeSet,
} from "../lib/core.mjs";
import { extract } from "../lib/ingest.mjs";
import { readTutorStream } from "../lib/stream.mjs";
import { sample } from "../lib/sample.mjs";
import { sampleQuestions as qs } from "../lib/sample-key.mjs";
test("source normalization, stable hashes, page offsets and bounded overlapping chunks", () => {
  const text = "A source paragraph about rainfall. ".repeat(150);
  const m = material([text, "An additional section about annual temperature."]);
  assert.equal(
    m.hash,
    material([text, "An additional section about annual temperature."]).hash,
  );
  assert.equal(m.pages, 2);
  assert.equal(m.chunks.at(-1).page, 2);
  assert.ok(m.chunks.every((c) => c.text.length <= 1800));
  assert.ok(m.chunks[1].start < m.chunks[0].end);
  assert.equal(
    m.chunks[1].text,
    text.slice(m.chunks[1].start, m.chunks[1].end),
  );
});
test("source rejects empty, oversized, scanned and excessive page inputs", () => {
  for (const p of [["   "], ["a".repeat(100001)], Array(101).fill("page")])
    assert.throws(() => material(p));
});
test("file extraction distinguishes valid text from binary data and invalid PDF signatures", async () => {
  assert.ok(
    (await extract(Buffer.from(sample.chunks[0].text), "TXT")).words > 10,
  );
  for (const [b, f] of [
    [Buffer.from([0xff]), "TXT"],
    [Buffer.from([0, 5, 31]), "TXT"],
    [Buffer.from("not a PDF"), "PDF"],
    [Buffer.alloc(5242881), "PDF"],
  ])
    await assert.rejects(extract(b, f));
});
test("MCQ shape, answer bounds, duplicated options and unresolved citations are checked", () => {
  const raw = { questions: qs };
  assert.equal(validate("quiz", raw, sample.chunks, 5).length, 5);
  for (const patch of [
    { options: ["one", "two", "three"] },
    { options: ["a", "b", "A", "d"] },
    { correct: 4 },
    { refs: ["unrelated"] },
  ]) {
    const x = structuredClone(raw);
    Object.assign(x.questions[0], patch);
    assert.throws(() => validate("quiz", x, sample.chunks, 5));
  }
});
test("quiz questions and active state exclude keys while history preserves submitted answers", () => {
  for (const q of publicQuestions(qs)) {
    assert.deepEqual(Object.keys(q).sort(), ["id", "options", "prompt"]);
  }
  const out = safeSet({
    content: {
      questions: qs,
      active: { questions: qs, id: "attempt" },
      attempts: [],
    },
  });
  assert.equal(out.questions, undefined);
  assert.equal(out.active.questions[0].correct, undefined);
});
test("all 3,125 combinations of selected and unanswered quiz choices score correctly", () => {
  for (let i = 0; i < 3125; i++) {
    let n = i,
      correct = 0,
      answered = 0;
    const answers = {};
    for (const q of qs) {
      const a = n % 5;
      n = Math.floor(n / 5);
      if (a < 4) {
        answers[q.id] = a;
        answered++;
        if (a === q.correct) correct++;
      }
    }
    const r = grade(qs, answers);
    assert.equal(r.correct, correct);
    assert.equal(r.answered, answered);
    assert.equal(
      r.score,
      answered ? Math.round((correct * 100) / answered) : 0,
    );
    assert.equal(
      r.results.filter((s) => s.selected === null).length,
      5 - answered,
    );
  }
});
test("tampered and invalid answers are rejected", () => {
  for (const v of [{ unrelated: 0 }, { q0: 4 }, { q0: -1 }, { q0: "1" }, []])
    assert.throws(() => grade(qs, v));
});
test("unsupported tutor answers abstain and supported quotes must occur in their declared source", () => {
  assert.deepEqual(
    validate(
      "tutor",
      { supported: false, evidence: [], answer: "Guess" },
      sample.chunks,
    ).refs,
    [],
  );
  for (const evidence of [
    [],
    [{ ref: "S7", quote: "false evidence" }],
    [{ ref: "S1", quote: "fabricated supporting quote" }],
  ])
    assert.throws(() =>
      validate(
        "tutor",
        { supported: true, answer: "Claim", evidence },
        sample.chunks,
      ),
    );
});
test("long retrieval can find evidence near the end", () => {
  const chunks = Array.from({ length: 28 }, (_, i) => ({
    id: "S" + i,
    text:
      "Generic lecture notes. ".repeat(50) +
      (i === 27 ? "orbital resonance" : ""),
  }));
  assert.equal(retrieve(chunks, "orbital resonance")[0].id, "S27");
});
test("sample summary, key terms and cards cite existing sections", () => {
  const refs = new Set(sample.chunks.map((c) => c.id));
  for (const row of [
    ...sample.cards,
    ...sample.summary.sections,
    ...sample.summary.terms,
    ...qs,
  ])
    assert.ok(row.refs.every((id) => refs.has(id)));
});
test("provider streaming delivers validated partial text and rejects incomplete streams", async () => {
  const quote = sample.chunks[0].text.slice(0, 42);
  const a = JSON.stringify({
    supported: true,
    evidence: [{ ref: "S1", quote }],
    answer: "Energy is stored in sugars.",
  });
  const packets = [a.slice(0, -12), a.slice(-12)]
    .map(
      (content) =>
        "data: " +
        JSON.stringify({ choices: [{ delta: { content } }] }) +
        "\n\n",
    )
    .join("");
  let visible = "";
  const stream = new Response(packets + "data: [DONE]\n\n").body;
  const res = await readTutorStream(
    stream,
    sample.chunks,
    (t) => (visible += t),
  );
  assert.equal(visible, res.answer);
  assert.deepEqual(res.refs, ["S1"]);
  await assert.rejects(
    readTutorStream(new Response(packets).body, sample.chunks, () => {}),
  );
});
test("real PDF parser preserves page anchors and rejects image-only files", async () => {
  const { pdfFixture } = await import("./pdf.mjs");
  const m = await extract(
    pdfFixture([
      "Rainfall is measured using a graduated collector.",
      "Temperature is measured with a calibrated thermometer.",
    ]),
    "PDF",
  );
  assert.equal(m.pages, 2);
  assert.deepEqual(
    m.chunks.map((c) => c.page),
    [1, 2],
  );
  assert.match(m.chunks[1].text, /thermometer/);
  await assert.rejects(extract(pdfFixture([""]), "PDF"));
});
test("40 synthetic evaluation documents and 120 review prompts have valid fixture expectations", async () => {
  const { documents } = await import("../evaluation/fixtures.mjs");
  assert.equal(documents.length, 40);
  assert.equal(documents.flatMap((d) => d.checks).length, 120);
  for (const d of documents) {
    const m = material([d.source]);
    for (const check of d.checks)
      if (check.expected)
        assert.ok(
          m.chunks.some((c) =>
            c.text.toLowerCase().includes(check.expected.toLowerCase()),
          ),
        );
  }
});
