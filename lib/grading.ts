import { randomUUID } from "node:crypto";
import { requireThat } from "./problem.ts";
export interface Question {
  id: string;
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
  refs: string[];
}
export function publicQuestions(questions: Question[]) {
  return questions.map(({ id, prompt, options }) => ({ id, prompt, options }));
}
export function grade(questions: Question[], answers: Record<string, number>) {
  requireThat(
    answers && typeof answers === "object" && !Array.isArray(answers),
    "Invalid answers.",
  );
  requireThat(
    Object.entries(answers).every(
      ([id, a]) =>
        questions.some((q) => q.id === id) &&
        Number.isInteger(a) &&
        a >= 0 &&
        a <= 3,
    ),
    "Invalid quiz choice.",
  );
  const results = questions.map((q) => ({
    ...q,
    selected: answers[q.id] ?? null,
    right: answers[q.id] === q.correct,
  }));
  const answered = Object.keys(answers).length,
    correct = results.filter((q) => q.right).length;
  return {
    id: randomUUID(),
    at: new Date().toISOString(),
    correct,
    answered,
    total: questions.length,
    score: answered ? Math.round((100 * correct) / answered) : 0,
    results,
  };
}
