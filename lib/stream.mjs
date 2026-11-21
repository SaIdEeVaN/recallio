import { parse } from "partial-json";
import { Problem, validate } from "./core.mjs";
export async function readTutorStream(body, evidence, emit) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "",
    json = "",
    sent = "",
    finished = false;
  function line(raw) {
    if (!raw.startsWith("data:")) return;
    const data = raw.slice(5).trim();
    if (data === "[DONE]") {
      finished = true;
      return;
    }
    if (!data) return;
    const event = JSON.parse(data);
    if (event.error)
      throw new Problem("The provider interrupted the reply.", 503);
    json += event.choices?.[0]?.delta?.content || "";
    let partial;
    try {
      partial = parse(json);
    } catch {
      return;
    }
    if (
      partial?.supported !== true ||
      !partial.answer?.trim() ||
      !partial.evidence?.length
    )
      return;
    try {
      validate("tutor", partial, evidence);
    } catch {
      return;
    }
    if (partial.answer.startsWith(sent)) {
      const addition = partial.answer.slice(sent.length);
      if (addition) {
        emit(addition);
        sent = partial.answer;
      }
    }
  }
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();
    for (const s of lines) line(s);
  }
  if (buffer) line(buffer);
  if (!finished)
    throw new Problem("The reply was interrupted. Please retry.", 503);
  const final = validate("tutor", JSON.parse(json), evidence);
  if (!sent) emit(final.answer);
  return final;
}
