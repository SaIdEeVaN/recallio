import { parseArgs } from "node:util";
import { getVercelOidcToken } from "@vercel/oidc";
import { defaultModel, requestModel } from "../lib/ai-generation.mjs";
import { readTutorStream } from "../lib/stream.mjs";
import { evaluate } from "./benchmark.mjs";
import { documents } from "./fixtures.mjs";

async function main() {
  const { values } = parseArgs({
    options: {
      gateway: { type: "boolean" },
      documents: { type: "string" },
      json: { type: "boolean" },
    },
  });
  const count = Number(values.documents ?? documents.length);
  if (!Number.isInteger(count) || count < 1 || count > documents.length)
    throw new Error("Choose --documents from 1 to " + documents.length + ".");
  if (values.gateway && !values.documents)
    throw new Error("Specify --documents to bound Gateway requests.");

  const mode = values.gateway ? "gateway" : "fixture";
  const model = values.gateway
    ? process.env.RECALLIO_MODEL || defaultModel
    : "scripted fixture";
  const key = values.gateway
    ? process.env.AI_GATEWAY_API_KEY ||
      (await getVercelOidcToken().catch(() => null))
    : null;
  if (values.gateway && !key)
    throw new Error(
      "Configure AI_GATEWAY_API_KEY or Vercel workload credentials.",
    );

  let requests = 0;
  const gatewayCall = async (instruction, input, maxTokens, signal, stream) => {
    requests++;
    const response = await requestModel({
      key,
      model,
      instruction,
      input,
      maxTokens,
      stream,
      signal: AbortSignal.timeout(55000),
    });
    if (!response.ok)
      throw Object.assign(new Error("Gateway request failed."), {
        status: response.status,
      });
    if (stream)
      return readTutorStream(response.body, stream.evidence, stream.emit);
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  };
  const report = await evaluate({
    mode,
    model,
    selected: documents.slice(0, count),
    gatewayCall,
  });
  if (mode === "gateway") report.requests = requests;
  if (values.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Recallio evaluation (${report.mode}, ${report.model})`);
    for (const type of ["grounded", "abstain", "citation", "quiz"]) {
      const rows = report.outcomes.filter((row) => row.kind === type);
      if (rows.length)
        console.log(
          `${type}: ${rows.filter((r) => r.status === "pass").length}/${rows.length} passed`,
        );
    }
    console.log(
      `${report.passed} passed, ${report.review} for review, ${report.failed} failed, ${report.skipped} skipped.`,
    );
    for (const row of report.outcomes.filter((row) => row.status !== "pass")) {
      console.log(`${row.id} (${row.title}): ${row.error || row.status}`);
    }
    if (report.stopped) console.log(report.stopped);
  }
  if (report.failed || report.review || report.skipped) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
