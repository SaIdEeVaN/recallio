import { getVercelOidcToken } from "@vercel/oidc";
import { Problem, requireThat } from "./core.mjs";
import {
  defaultModel,
  gatewayEndpoint,
  generateWith,
  requestModel,
} from "./ai-generation.mjs";
import { readTutorStream } from "./stream.mjs";
import { reserve } from "./db.mjs";
async function call(ctx, instruction, input, maxTokens, signal, stream) {
  requireThat(
    process.env.RECALLIO_AI_ENABLED !== "false",
    "AI generation is paused.",
    503,
  );
  await reserve(ctx, "ai");
  const key =
    process.env.AI_GATEWAY_API_KEY ||
    (await getVercelOidcToken().catch(() => null));
  requireThat(key, "AI Gateway access is unavailable.", 503);
  const started = Date.now(),
    model = process.env.RECALLIO_MODEL || defaultModel;
  const endpoint =
    process.env.NODE_ENV === "development" &&
    ["http://127.0.0.1:3190/model", "http://127.0.0.1:3196/model"].includes(
      process.env.RECALLIO_TEST_GATEWAY,
    )
      ? process.env.RECALLIO_TEST_GATEWAY
      : gatewayEndpoint;
  const response = await requestModel({
    endpoint,
    key,
    model,
    instruction,
    input,
    maxTokens,
    stream,
    signal: AbortSignal.any([
      AbortSignal.timeout(55000),
      ...(signal ? [signal] : []),
    ]),
  }).catch(() => {
    throw new Problem(
      "The model request timed out or was interrupted. Please retry.",
      503,
    );
  });
  if (!response.ok) {
    console.info(
      JSON.stringify({
        event: "provider_error",
        status: response.status,
        model,
      }),
    );
    throw new Problem(
      [402, 403].includes(response.status)
        ? "AI generation is unavailable for this deployment. Your source is saved."
        : "The AI provider is temporarily unavailable. Your source is saved.",
      503,
    );
  }
  if (stream)
    return readTutorStream(response.body, stream.evidence, stream.emit);
  const result = await response.json();
  console.info(
    JSON.stringify({
      event: "generation",
      model,
      ms: Date.now() - started,
      inputTokens: result.usage?.prompt_tokens,
      outputTokens: result.usage?.completion_tokens,
    }),
  );
  try {
    return JSON.parse(result.choices[0].message.content);
  } catch {
    throw new Problem(
      "The generated response was incomplete. Please retry.",
      422,
    );
  }
}
export function generate(ctx, kind, chunks, options, signal) {
  return generateWith(
    (...args) => call(ctx, ...args),
    kind,
    chunks,
    options,
    signal,
  );
}
