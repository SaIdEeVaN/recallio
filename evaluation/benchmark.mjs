import { generateWith } from "../lib/ai-generation.mjs";
import { grade, material, publicQuestions } from "../lib/core.mjs";
import { readTutorStream } from "../lib/stream.mjs";

function* cases(selected) {
  for (const doc of selected) {
    const { chunks } = material([doc.source]);
    for (const [index, check] of doc.checks.entries()) {
      yield {
        ...check,
        id: doc.id + "-tutor-" + (index + 1),
        title: doc.title,
        chunks,
        previous: doc.checks[0],
      };
    }
  }
  for (let offset = 0; offset + 5 <= selected.length; offset += 5) {
    const group = selected.slice(offset, offset + 5);
    const { chunks } = material(group.map((doc) => doc.source));
    yield {
      id: "quiz-" + (offset / 5 + 1),
      title: group.map((doc) => doc.title).join(", "),
      kind: "quiz",
      chunks,
      anchors: group.map((doc, index) => ({
        ...doc.checks[0],
        ref: chunks[index].id,
      })),
    };
  }
}

function contains(text, phrase) {
  const normalize = (value) =>
    " " +
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim() +
    " ";
  return normalize(text).includes(
    normalize(phrase.replace(/^(a|an|the) /i, "")),
  );
}

function tutorAssessment(test, result, displayed) {
  const citations = result.evidence;
  const streamed = displayed === result.answer;
  const abstained = citations.length === 0;
  const supported = test.kind !== "abstain";
  const anchor =
    supported && citations.some((e) => contains(e.quote, test.expected));
  const answerAnchor =
    test.kind !== "grounded" || contains(result.answer, test.expected);
  const status =
    !streamed || supported === abstained
      ? "fail"
      : supported && (!anchor || !answerAnchor)
        ? "review"
        : "pass";
  return {
    status,
    checks: {
      streamed,
      expectedAbstention: !supported,
      abstained,
      ...(supported
        ? { evidenceContainsAnchor: anchor, answerContainsAnchor: answerAnchor }
        : {}),
    },
    sample: {
      question: test.question,
      expected: test.expected,
      answer: result.answer,
      citations,
    },
  };
}

function quizAssessment(test, questions) {
  const key = Object.fromEntries(questions.map((q) => [q.id, q.correct]));
  const wrong = Object.fromEntries(
    questions.map((q) => [q.id, (q.correct + 1) % q.options.length]),
  );
  const checks = {
    correctAnswers: grade(questions, key).correct === questions.length,
    wrongAnswers: grade(questions, wrong).correct === 0,
    unanswered: grade(questions, {}).answered === 0,
    answerKeyHidden: publicQuestions(questions).every(
      (question) =>
        Object.keys(question).sort().join(",") === "id,options,prompt",
    ),
  };
  const sample = questions.map(({ id, refs, ...question }) => ({
    ...question,
    evidence: refs.map((ref) => ({
      ref,
      text: test.chunks.find((chunk) => chunk.id === ref).text,
    })),
    answerAppearsInSource: refs.some((ref) =>
      contains(
        test.chunks.find((chunk) => chunk.id === ref).text,
        question.options[question.correct],
      ),
    ),
  }));
  const status = !Object.values(checks).every(Boolean)
    ? "fail"
    : sample.every((q) => q.answerAppearsInSource)
      ? "pass"
      : "review";
  return { status, checks, sample };
}

async function fixtureCall(
  test,
  _instruction,
  input,
  _maxTokens,
  _signal,
  stream,
) {
  if (test.kind === "quiz") {
    return {
      questions: test.anchors.map((anchor, index) => {
        const options = test.anchors
          .filter((other) => other !== anchor)
          .slice(0, 3)
          .map((other) => other.expected);
        const correct = index % 4;
        options.splice(correct, 0, anchor.expected);
        return {
          prompt: anchor.question,
          options,
          correct,
          explanation: input.sections.find(
            (section) => section.id === anchor.ref,
          ).text,
          refs: [anchor.ref],
        };
      }),
    };
  }
  if (
    test.kind === "citation" &&
    !input.history.some((message) => message.role === "assistant")
  )
    throw new Error("Follow-up history did not reach the fixture transport.");
  const raw =
    test.kind === "abstain"
      ? { supported: false, evidence: [], answer: "The source does not say." }
      : {
          supported: true,
          evidence: [
            {
              ref: input.sections[0].id,
              quote: input.sections[0].text.split("\n\n")[1],
            },
          ],
          answer: test.expected,
        };
  const pieces = JSON.stringify(raw).match(/.{1,32}/gu);
  const events = pieces.map(
    (content) =>
      "data: " + JSON.stringify({ choices: [{ delta: { content } }] }) + "\n\n",
  );
  return readTutorStream(
    new Response(events.join("") + "data: [DONE]\n\n").body,
    stream.evidence,
    stream.emit,
  );
}

export async function evaluate({ mode, model, selected, gatewayCall }) {
  const outcomes = [];
  let stopped;
  const plan = [...cases(selected)];
  for (const test of plan) {
    const call =
      mode === "fixture"
        ? (...args) => fixtureCall(test, ...args)
        : gatewayCall;
    const { id, title, kind } = test;
    try {
      let evaluation;
      if (kind === "quiz") {
        const questions = await generateWith(call, "quiz", test.chunks, {
          count: 5,
        });
        evaluation = quizAssessment(test, questions);
      } else {
        const { previous } = test;
        const messages =
          kind === "citation"
            ? [
                { role: "user", text: previous.question },
                { role: "assistant", text: previous.expected },
              ]
            : [];
        let displayed = "";
        const result = await generateWith(call, "tutor", test.chunks, {
          question: test.question,
          messages,
          emit: (delta) => {
            displayed += delta;
          },
        });
        evaluation = tutorAssessment(test, result, displayed);
      }
      outcomes.push({ id, title, kind, ...evaluation });
    } catch (error) {
      outcomes.push({
        id,
        title,
        kind,
        status: "fail",
        error:
          error.status === 422
            ? error.message
            : error.status
              ? "HTTP " + error.status
              : "Invalid or incomplete response",
      });
      if ([401, 402, 403, 429].includes(error.status)) {
        stopped = "Gateway returned HTTP " + error.status;
        break;
      }
    }
  }
  return {
    mode,
    model,
    documents: selected.length,
    planned: plan.length,
    skipped: plan.length - outcomes.length,
    passed: outcomes.filter((test) => test.status === "pass").length,
    review: outcomes.filter((test) => test.status === "review").length,
    failed: outcomes.filter((test) => test.status === "fail").length,
    stopped,
    outcomes,
  };
}
