"use client";
import { useState, useRef, useEffect } from "react";
import {
  FileText,
  BookOpen,
  Layers,
  ClipboardList,
  Sparkles,
  Settings2,
  Pencil,
  Check,
  RotateCcw,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Trash2,
  Plus,
  Send,
  Square,
  Leaf,
} from "lucide-react";
import { sample } from "../lib/sample.mjs";
import { request, supabase } from "../lib/client";
import { modes, Citations, Modal, DateText } from "./ui";
export default function Workspace({
  item,
  tab,
  setTab,
  update,
  notify,
  refresh,
  rename,
}) {
  const isDemo = item.id === "sample",
    [dialog, M] = useState(""),
    [focus, F] = useState(""),
    [busy, B] = useState(""),
    [kind, K] = useState("summary"),
    [count, C] = useState(5),
    [length, L] = useState("medium"),
    [append, Y] = useState(false),
    [feedback, Q] = useState("");
  const running = useRef(false),
    requestIds = useRef({});
  async function action(name, data = {}) {
    const s = await request(name, { id: item.id, ...data });
    update(s);
    refresh();
    return s;
  }
  async function guarded(fn) {
    if (running.current) return;
    running.current = true;
    B("Saving…");
    Q("");
    try {
      await fn();
    } catch (e) {
      Q(e.message);
    } finally {
      B("");
      running.current = false;
    }
  }
  function cite(id) {
    F(id);
    setTab("Source");
    setTimeout(() => {
      const el = document.getElementById("src-" + id);
      el?.focus();
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 60);
  }
  async function runGen() {
    await guarded(async () => {
      for (const k of kind === "all" ? ["summary", "cards", "quiz"] : [kind]) {
        B("Generating " + k + "…");
        const signature = [k, count, length, append].join("/");
        const rid = (requestIds.current[signature] ||= crypto.randomUUID());
        await action("generate", {
          kind: k,
          count: Number(count),
          length,
          append,
          requestId: rid,
        });
        delete requestIds.current[signature];
      }
      M("");
      setTab(
        kind === "cards" ? "Flashcards" : kind === "quiz" ? "Quiz" : "Summary",
      );
      notify("Study tools saved.");
    });
  }
  function gen(k) {
    K(k);
    Q("");
    C(5);
    M("generate");
  }
  const displayTab = tab === "Review" ? "Flashcards" : tab;
  return (
    <>
      <div className="workIntro">
        <div className="eyebrow">
          <span className="dash" />
          {isDemo ? "Sample study set" : "Private study set"}
        </div>
        <h1>{item.title}</h1>
        <div className="workMeta">
          <span>
            <FileText size={15} />
            {item.format}
          </span>
          <span>{item.chunks?.length || 0} source sections</span>
          {item.words && <span>{item.words.toLocaleString()} words</span>}
          {item.format === "PDF" && (
            <span>
              {item.pages} {item.pages === 1 ? "page" : "pages"}
            </span>
          )}
          {!isDemo && (
            <button className="quiet" onClick={rename}>
              <Pencil size={14} />
              Rename
            </button>
          )}
        </div>
      </div>
      <div className="tabs" aria-label="Study modes">
        {[{ name: "Source", icon: FileText }, ...modes].map(
          ({ name, icon: I }) => (
            <button
              key={name}
              aria-current={name === displayTab ? "page" : undefined}
              onClick={() => {
                setTab(name);
                Q("");
              }}
              className={name === displayTab ? "on" : ""}
            >
              <I size={16} />
              {name}
            </button>
          ),
        )}
      </div>
      {feedback && dialog !== "generate" && (
        <p className="notice" role="alert">
          {feedback}
        </p>
      )}
      {displayTab === "Source" && (
        <div className="panel reading">
          <div className="sectionHead">
            <h2>Source notebook</h2>
            {!isDemo && item.status === "ready" && (
              <button className="primary" onClick={() => gen("all")}>
                <Sparkles size={16} />
                Generate tools
              </button>
            )}
          </div>
          {item.emptyPages > 0 && (
            <p className="notice">
              {item.emptyPages} empty or image-only pages had no extractable
              text.
            </p>
          )}
          {item.status && item.status !== "ready" && (
            <p className="notice">
              Source status is {item.status}.{" "}
              <button
                className="quiet"
                onClick={() => guarded(() => action("extract"))}
              >
                Retry extraction
              </button>
            </p>
          )}
          {item.chunks?.map((c) => (
            <section
              key={c.id}
              tabIndex={-1}
              id={"src-" + c.id}
              className={"passage " + (focus === c.id ? "highlight" : "")}
            >
              <small>
                {c.id}
                {c.page ? " · Page " + c.page : ""}
              </small>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
            </section>
          ))}
        </div>
      )}
      {displayTab === "Summary" &&
        (item.summary ? (
          <div className="panel reading">
            <div className="sectionHead">
              <h2>Summary</h2>
              {!isDemo && (
                <button className="quiet" onClick={() => gen("summary")}>
                  <RotateCcw size={15} />
                  Regenerate
                </button>
              )}
            </div>
            {item.summary.sections.map((s, i) => (
              <section className="passage" key={i}>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                <Citations refs={s.refs} cite={cite} />
              </section>
            ))}
            <h2 className="termsHead">Key terms</h2>
            {item.summary.terms.map((t) => (
              <div key={t.term} className="term">
                <strong>{t.term}</strong>
                <p>{t.definition}</p>
                <Citations refs={t.refs} cite={cite} />
              </div>
            ))}
          </div>
        ) : (
          <GenerateEmpty title="Summary" gen={() => gen("summary")} />
        ))}
      {displayTab === "Flashcards" &&
        (item.cards?.length ? (
          <Cards
            item={item}
            initialFilter={tab === "Review"}
            update={update}
            action={action}
            cite={cite}
            gen={() => gen("cards")}
            notify={notify}
          />
        ) : (
          <GenerateEmpty
            title="Flashcards"
            gen={
              isDemo
                ? () => {
                    update({ ...item, cards: structuredClone(sample.cards) });
                  }
                : () => gen("cards")
            }
            label={isDemo ? "Restore sample cards" : undefined}
          />
        ))}
      {displayTab === "Quiz" &&
        (item.questionsCount || item.active || item.attempts.length ? (
          <Quiz
            item={item}
            update={update}
            action={action}
            cite={cite}
            gen={() => gen("quiz")}
          />
        ) : (
          <GenerateEmpty title="Quiz" gen={() => gen("quiz")} />
        ))}
      {displayTab === "Tutor" && (
        <Tutor item={item} update={update} action={action} cite={cite} />
      )}
      {dialog === "generate" && (
        <Modal
          title="Generate study tools"
          onClose={() => {
            if (!busy) M("");
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runGen();
            }}
          >
            <label>
              Study tool
              <select
                value={kind}
                onChange={(e) => {
                  K(e.target.value);
                  C(5);
                }}
              >
                <option value="all">Summary, flashcards & quiz</option>
                <option value="summary">Summary</option>
                <option value="cards">Flashcards</option>
                <option value="quiz">Quiz</option>
              </select>
            </label>
            {["all", "summary"].includes(kind) && (
              <label>
                Summary length
                <select value={length} onChange={(e) => L(e.target.value)}>
                  {["short", "medium", "detailed"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            )}
            {kind !== "summary" && (
              <label>
                Items per practice tool
                <input
                  type="number"
                  min="5"
                  max={kind === "cards" ? 30 : 20}
                  value={count}
                  onChange={(e) => C(e.target.value)}
                  required
                />
              </label>
            )}
            {["cards", "all"].includes(kind) && item.cards.length > 0 && (
              <label>
                Existing cards
                <select
                  value={append ? "append" : "replace"}
                  onChange={(e) => Y(e.target.value === "append")}
                >
                  <option value="replace">
                    Replace existing deck and edits
                  </option>
                  <option value="append">Append to existing deck</option>
                </select>
              </label>
            )}
            <small>
              Generation replaces selected summaries and quizzes. Past quiz
              results stay in your history.
            </small>
            <button className="primary" disabled={!!busy}>
              <Sparkles size={16} />
              {busy || "Generate"}
            </button>
            {feedback && <p role="alert">{feedback}</p>}
          </form>
        </Modal>
      )}
    </>
  );
}
function GenerateEmpty({ title, gen, label }) {
  return (
    <div className="panel empty">
      <BookOpen />
      <h2>{title}</h2>
      <p>Build this study tool from the saved source.</p>
      <button className="primary" onClick={gen}>
        {label || "Generate " + title.toLowerCase()}
      </button>
    </div>
  );
}
function Cards({ item, initialFilter, update, action, cite, gen, notify }) {
  const [filter, H] = useState(initialFilter),
    [index, I] = useState(0),
    [flipped, F] = useState(false),
    [hint, J] = useState(false),
    [order, O] = useState([]),
    [modal, M] = useState(""),
    [front, U] = useState(""),
    [back, V] = useState(""),
    [busy, B] = useState(false);
  const list = item.cards
    .filter((c) => !filter || c.status === "review")
    .sort((a, b) =>
      order.length ? order.indexOf(a.id) - order.indexOf(b.id) : 0,
    );
  const pos = Math.min(index, Math.max(0, list.length - 1)),
    card = list[pos],
    demo = item.id === "sample";
  function go(n) {
    I(list.length ? (n + list.length) % list.length : 0);
    F(false);
    J(false);
  }
  async function mutate(op) {
    if (busy || !card) return;
    B(true);
    try {
      if (demo) {
        let cards = item.cards.map((c) =>
          c.id !== card.id
            ? c
            : op === "edit"
              ? { ...c, front, back }
              : { ...c, status: op, reviewedAt: new Date().toISOString() },
        );
        if (op === "delete") cards = cards.filter((c) => c.id !== card.id);
        update({ ...item, cards });
      } else await action("card", { item: card.id, op, front, back });
      if (op === "known" || op === "review") go(filter ? pos : pos + 1);
      M("");
    } catch (e) {
      notify(e.message);
    } finally {
      B(false);
    }
  }
  function shuffle() {
    const a = list.map((c) => c.id);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    O(a);
    go(0);
  }
  return (
    <section className="panel">
      <div className="sectionHead">
        <h2>Flashcards</h2>
        {!demo && (
          <button className="quiet" onClick={gen}>
            <RotateCcw size={15} />
            Regenerate
          </button>
        )}
      </div>
      <div className="toolbar">
        <label className="check">
          <input
            type="checkbox"
            checked={filter}
            onChange={(e) => {
              H(e.target.checked);
              go(0);
            }}
          />
          Review again only
        </label>
        <button className="quiet" onClick={shuffle}>
          <Shuffle size={15} />
          Shuffle
        </button>
      </div>
      {card ? (
        <>
          <div className="cardMeta">
            <span>
              Card {pos + 1} of {list.length}
            </span>
            <span>
              {card.status === "known"
                ? "Known"
                : card.status === "review"
                  ? "Needs review"
                  : "New card"}
            </span>
          </div>
          <button
            className="flipCard"
            aria-describedby="current-card-text"
            onClick={() => F(!flipped)}
            aria-label={flipped ? "Show question" : "Reveal answer"}
          >
            <span>{flipped ? "Answer" : "Recall prompt"}</span>
            <strong id="current-card-text">
              {flipped ? card.back : card.front}
            </strong>
            <small>
              <RotateCcw size={14} />{" "}
              {flipped ? "Show question" : "Flip to reveal"}
            </small>
          </button>
          {flipped && <Citations refs={card.refs} cite={cite} />}
          <div className="actions spread">
            <button
              aria-label="Previous card"
              className="square"
              onClick={() => go(pos - 1)}
            >
              <ChevronLeft />
            </button>
            <div className="actions">
              <button
                disabled={busy}
                className="outline"
                onClick={() => mutate("review")}
              >
                <RotateCcw size={16} />
                Review again
              </button>
              <button
                disabled={busy}
                className="primary"
                onClick={() => mutate("known")}
              >
                <Check size={16} />
                Know it
              </button>
            </div>
            <button
              aria-label="Next card"
              className="square"
              onClick={() => go(pos + 1)}
            >
              <ChevronRight />
            </button>
          </div>
          <div className="actions">
            <button className="quiet" onClick={() => J(!hint)}>
              <Lightbulb size={15} />
              {hint ? "Hide hint" : "Hint"}
            </button>
            <button
              className="quiet"
              onClick={() => {
                U(card.front);
                V(card.back);
                M("edit");
              }}
            >
              <Pencil size={15} />
              Edit
            </button>
            <button className="quiet" onClick={() => M("delete")}>
              <Trash2 size={15} />
              Delete
            </button>
          </div>
          {hint && (
            <p className="notice">
              {card.hint || "Open the source citation for a clue."}
            </p>
          )}
        </>
      ) : (
        <p>No cards currently need review.</p>
      )}
      {modal === "edit" && (
        <Modal title="Edit flashcard" onClose={() => M("")}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutate("edit");
            }}
          >
            <label>
              Front
              <textarea
                required
                maxLength="1000"
                value={front}
                onChange={(e) => U(e.target.value)}
              />
            </label>
            <label>
              Back
              <textarea
                required
                maxLength="3500"
                value={back}
                onChange={(e) => V(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy}>
              Save card
            </button>
          </form>
        </Modal>
      )}
      {modal === "delete" && (
        <Modal title="Delete flashcard?" onClose={() => M("")}>
          <p>{card?.front}</p>
          <button
            className="danger"
            disabled={busy}
            onClick={() => mutate("delete")}
          >
            Delete card
          </button>
        </Modal>
      )}
    </section>
  );
}
function Quiz({ item, update, action, cite, gen }) {
  const [idx, I] = useState(0),
    [answers, A] = useState({}),
    [shown, S] = useState(null),
    [mode, M] = useState("final"),
    [busy, B] = useState(false),
    [error, E] = useState("");
  const active = item.active,
    demo = item.id === "sample",
    q = active?.questions[Math.min(idx, active.questions.length - 1)],
    result = item.attempts.find((a) => a.id === shown);
  useEffect(() => {
    if (!active?.id) return;
    try {
      A(
        JSON.parse(
          sessionStorage.getItem("recallio.quiz." + active.id) || "{}",
        ),
      );
    } catch {}
  }, [active?.id]);
  function choose(id, val) {
    const next = { ...answers, [id]: val };
    A(next);
    sessionStorage.setItem("recallio.quiz." + active.id, JSON.stringify(next));
  }
  async function run(fn) {
    if (busy) return;
    B(true);
    E("");
    try {
      await fn();
    } catch (e) {
      E(e.message);
    } finally {
      B(false);
    }
  }
  async function start(retry) {
    await run(async () => {
      if (demo) {
        const { questions } = await request("start", { id: "sample" });
        const wrong =
          retry &&
          item.attempts
            .find((x) => x.id === retry)
            .results.filter((x) => !x.right)
            .map((q) => q.id);
        update({
          ...item,
          active: {
            id: crypto.randomUUID(),
            mode,
            questions: wrong
              ? questions.filter((q) => wrong.includes(q.id))
              : questions,
            locked: {},
            checked: {},
          },
        });
      } else await action("start", { mode, retry });
      A({});
      S(null);
      I(0);
    });
  }
  async function check() {
    await run(async () => {
      if (demo) {
        const res = await request("grade", {
          id: "sample",
          ids: [q.id],
          answers: { [q.id]: answers[q.id] },
        });
        update({
          ...item,
          active: {
            ...active,
            locked: { ...active.locked, [q.id]: answers[q.id] },
            checked: { ...active.checked, [q.id]: res.results[0] },
          },
        });
      } else
        await action("check", {
          attempt: active.id,
          item: q.id,
          choice: answers[q.id],
        });
    });
  }
  async function finish() {
    await run(async () => {
      if (demo) {
        const res = await request("grade", {
          id: "sample",
          ids: active.questions.map((q) => q.id),
          answers: { ...answers, ...active.locked },
        });
        update({ ...item, active: null, attempts: [res, ...item.attempts] });
        S(res.id);
      } else {
        const s = await action("grade", { attempt: active.id, answers });
        S(s.attempts[0].id);
      }
      sessionStorage.removeItem("recallio.quiz." + active.id);
    });
  }
  const locked = active?.checked?.[q?.id],
    choice = active?.locked?.[q?.id] ?? answers[q?.id];
  return (
    <div className="panel">
      <div className="sectionHead">
        <h2>Practice quiz</h2>
        {!demo && !active && (
          <button className="quiet" onClick={gen}>
            <RotateCcw size={15} />
            Regenerate
          </button>
        )}
      </div>
      {active && q ? (
        <>
          <div className="cardMeta">
            <span>
              Question {idx + 1} of {active.questions.length}
            </span>
            <span>
              {active.mode === "final"
                ? "Feedback at the end"
                : "Immediate feedback"}
            </span>
          </div>
          <fieldset className="options">
            <legend>{q.prompt}</legend>
            {q.options.map((o, i) => (
              <label key={i} className={choice === i ? "chosen" : ""}>
                <input
                  type="radio"
                  name={q.id}
                  disabled={!!locked}
                  checked={choice === i}
                  onChange={() => choose(q.id, i)}
                />
                {o}
              </label>
            ))}
          </fieldset>
          {locked && (
            <p className="notice">
              {choice === locked.correct
                ? "Correct. "
                : "Correct answer: " + q.options[locked.correct] + ". "}
              {locked.explanation} <Citations refs={locked.refs} cite={cite} />
            </p>
          )}
          <div className="actions">
            <button
              className="outline"
              disabled={idx === 0 || busy}
              onClick={() => I(idx - 1)}
            >
              Previous
            </button>
            {active.mode === "immediate" && !locked && choice != null && (
              <button className="outline" disabled={busy} onClick={check}>
                Check answer
              </button>
            )}
            {idx < active.questions.length - 1 ? (
              <button className="primary" onClick={() => I(idx + 1)}>
                Next question
              </button>
            ) : (
              <button className="primary" disabled={busy} onClick={finish}>
                Submit quiz
              </button>
            )}
          </div>
        </>
      ) : result ? (
        <>
          <div className="score">
            <strong>{result.score}%</strong>
            <span>
              {result.correct} of {result.answered} answered correctly ·{" "}
              {result.total - result.answered} unanswered
            </span>
          </div>
          <div className="actions">
            <button className="outline" onClick={() => S(null)}>
              Quiz overview
            </button>
            {result.results.some((q) => !q.right) && (
              <button
                disabled={busy}
                className="primary"
                onClick={() => start(result.id)}
              >
                Retry missed
              </button>
            )}
          </div>
          {result.results.map((r, i) => (
            <section key={r.id} className="passage">
              <small>
                {r.right
                  ? "Correct"
                  : r.selected === null
                    ? "Unanswered"
                    : "Incorrect"}
              </small>
              <h3>
                {i + 1}. {r.prompt}
              </h3>
              <p>
                Your answer:{" "}
                {r.selected === null ? "Skipped" : r.options[r.selected]}
                <br />
                Correct answer: {r.options[r.correct]}
              </p>
              <p>{r.explanation}</p>
              <Citations refs={r.refs} cite={cite} />
              {!demo && (
                <button
                  className="quiet"
                  onClick={() =>
                    run(async () => {
                      await action("removeQuestion", { item: r.id });
                      E("Question removed from future quizzes.");
                    })
                  }
                >
                  Remove from future quizzes
                </button>
              )}
            </section>
          ))}
        </>
      ) : (
        <>
          <p>
            {item.questionsCount} questions · Scores use answered questions.
            Skipped questions appear in your review.
          </p>
          <label className="compact">
            Feedback
            <select value={mode} onChange={(e) => M(e.target.value)}>
              <option value="final">After submission</option>
              <option value="immediate">After each answer</option>
            </select>
          </label>
          <button
            className="primary"
            disabled={busy || !item.questionsCount}
            onClick={() => start()}
          >
            Start quiz
          </button>
          {item.attempts.length > 0 && (
            <>
              <h3 className="termsHead">Attempt history</h3>
              {item.attempts.map((a) => (
                <button className="history" key={a.id} onClick={() => S(a.id)}>
                  <DateText value={a.at} />
                  <strong>
                    {a.correct} / {a.answered} answered correctly
                  </strong>
                  <span>View results</span>
                </button>
              ))}
            </>
          )}
        </>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
const samplePrompts = [
  [
    "Why do leaves look green?",
    "Chlorophyll absorbs blue and red light most strongly. Much of the green light is reflected or transmitted, so most leaves appear green.",
    "S2",
  ],
  [
    "Where does the oxygen come from?",
    "Water is split during the light-dependent reactions. That process supplies electrons and releases oxygen.",
    "S3",
  ],
  [
    "What happens when stomata close?",
    "Closing stomata reduces water loss, but it also restricts carbon dioxide entry and can limit photosynthesis.",
    "S5",
  ],
];
function Tutor({ item, update, action, cite }) {
  const demo = item.id === "sample",
    [text, T] = useState(""),
    [error, E] = useState(""),
    [live, L] = useState(""),
    [busy, B] = useState(false),
    [clear, C] = useState(false);
  const abort = useRef(null),
    retry = useRef(null);
  useEffect(() => () => abort.current?.abort(), []);
  async function ask(input = text) {
    if (!input.trim() || busy) return;
    B(true);
    E("");
    L("Finding supporting passages…");
    const id =
      retry.current?.question === input
        ? retry.current.id
        : crypto.randomUUID();
    retry.current = { question: input, id };
    abort.current = new AbortController();
    try {
      if (demo) {
        const match = samplePrompts.find((x) => x[0] === input);
        const a = match
          ? { text: match[1], refs: [match[2]] }
          : {
              text: "The sample tutor has three prepared answers. Choose a sample question, or create a private study set to ask your own.",
              refs: [],
            };
        update({
          ...item,
          messages: [
            ...item.messages,
            { role: "user", text: input, id: id + "-q" },
            { role: "assistant", id, ...a },
          ],
        });
      } else {
        const { data } = await supabase().auth.getSession();
        const r = await fetch("/api/tutor", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + data.session.access_token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: item.id, question: input, requestId: id }),
          signal: abort.current.signal,
        });
        if (!r.ok) throw new Error((await r.json()).error);
        const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
        let pending = "",
          answer = "",
          done = false;
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          pending += part.value;
          const lines = pending.split("\n");
          pending = lines.pop();
          for (const line of lines) {
            if (!line) continue;
            const event = JSON.parse(line);
            if (event.error) throw new Error(event.error);
            if (event.status) L(event.status);
            if (event.text) {
              answer += event.text;
              L(answer);
            }
            if (event.complete) done = true;
          }
        }
        if (!done)
          throw new Error("The reply was interrupted. Retry your question.");
        await action("open");
      }
      T("");
      retry.current = null;
    } catch (e) {
      E(
        e.name === "AbortError"
          ? "Reply stopped. You can retry your question."
          : e.message,
      );
    } finally {
      L("");
      B(false);
    }
  }
  return (
    <div className="panel">
      <div className="sectionHead">
        <h2>Ask tutor</h2>
        {item.messages.length > 0 && (
          <button className="quiet" disabled={busy} onClick={() => C(true)}>
            <Trash2 size={15} />
            Clear history
          </button>
        )}
      </div>
      <p>
        {demo
          ? "Explore three prepared answers from the sample notes."
          : "Ask a question about this study set. Open a citation to check the answer in context."}
      </p>
      {demo && (
        <div className="suggest">
          {samplePrompts.map((x) => (
            <button
              className="outline"
              key={x[0]}
              disabled={busy}
              onClick={() => ask(x[0])}
            >
              {x[0]}
            </button>
          ))}
        </div>
      )}
      {item.messages.map((m, i) => (
        <div className={"bubble " + m.role} key={m.id || i}>
          <small>{m.role === "user" ? "You" : "Recallio tutor"}</small>
          <p>{m.text}</p>
          <Citations refs={m.refs} cite={cite} />
        </div>
      ))}
      {live && <p role="status">{live}</p>}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {!demo && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
        >
          <label>
            Your question
            <textarea
              required
              maxLength="1500"
              rows="2"
              value={text}
              onChange={(e) => T(e.target.value)}
              placeholder="What do these notes say about…?"
            />
          </label>
          <div className="actions">
            <button className="primary" disabled={busy}>
              <Send size={15} />
              Ask tutor
            </button>
            {busy && (
              <button
                className="outline"
                type="button"
                onClick={() => abort.current?.abort()}
              >
                <Square size={13} />
                Stop
              </button>
            )}
          </div>
        </form>
      )}
      {clear && (
        <Modal title="Clear tutor history?" onClose={() => C(false)}>
          <p>This removes the conversation for this study set.</p>
          <button
            className="danger"
            onClick={async () => {
              try {
                if (demo) update({ ...item, messages: [] });
                else await action("clearChat");
                C(false);
              } catch (e) {
                E(e.message);
              }
            }}
          >
            Clear conversation
          </button>
        </Modal>
      )}
    </div>
  );
}
