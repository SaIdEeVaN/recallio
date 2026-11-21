import { Worker } from "node:worker_threads";
import path from "node:path";
import { requireThat, material, Problem } from "./core.mjs";
export async function extract(bytes, format) {
  requireThat(
    bytes.length > 0 && bytes.length <= 5242880,
    "Files must be between 1 byte and 5 MB.",
  );
  if (format === "TXT") {
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Problem("Please save this TXT file using UTF-8.");
    }
    // Reject binary control characters in a purported text file.
    // eslint-disable-next-line no-control-regex
    const hasBinaryControls = /[\u0000-\u0008\u000e-\u001f]/u.test(text);
    requireThat(
      !hasBinaryControls && !text.startsWith("%PDF-"),
      "This file is not plain text.",
    );
    return material([text]);
  }
  requireThat(
    Buffer.from(bytes.subarray(0, 5)).toString() === "%PDF-",
    "The file signature does not match a PDF.",
  );
  const pages = await new Promise((resolve, reject) => {
    const worker = new Worker(path.join(process.cwd(), "lib/pdf-worker.mjs"), {
      workerData: Uint8Array.from(bytes),
      resourceLimits: { maxOldGenerationSizeMb: 128 },
      execArgv: [],
    });
    const timeout = setTimeout(() => {
      reject(
        new Problem(
          "PDF processing exceeded 20 seconds. Try a smaller document.",
        ),
      );
      void worker.terminate();
    }, 20000);
    worker.once("message", (result) => {
      if (result.error) reject(new Problem(result.error));
      else resolve(result.pages);
      void worker.terminate();
    });
    worker.once("error", () =>
      reject(
        new Problem("PDF processing failed. Try a smaller text-based PDF."),
      ),
    );
    worker.once("exit", () => {
      clearTimeout(timeout);
      reject(new Problem("PDF processing stopped. Please retry."));
    });
  });
  const result = material(pages);
  return {
    ...result,
    chunks: result.chunks.map((c) => ({ ...c, page: c.page ?? 1 })),
  };
}
