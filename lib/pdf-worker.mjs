import { parentPort, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
const assets = (kind) =>
  fileURLToPath(
    new URL("../node_modules/pdfjs-dist/" + kind + "/", import.meta.url),
  );
try {
  const task = getDocument({
    data: workerData,
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    stopAtErrors: true,
    standardFontDataUrl: assets("standard_fonts"),
    cMapUrl: assets("cmaps"),
    cMapPacked: true,
  });
  const pdf = await task.promise;
  if (pdf.numPages > 100) throw new Error("PDF exceeds 100 pages.");
  const pages = [];
  let length = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((x) => ("str" in x ? x.str + (x.hasEOL ? "\n" : " ") : ""))
      .join("");
    length += text.length;
    if (length > 100000)
      throw new Error("Extracted text exceeds 100,000 characters.");
    pages.push(text);
    page.cleanup();
  }
  await task.destroy();
  parentPort.postMessage({ pages });
} catch (e) {
  const allowed = [
    "PDF exceeds 100 pages.",
    "Extracted text exceeds 100,000 characters.",
  ];
  parentPort.postMessage({
    error: allowed.includes(e.message)
      ? e.message
      : "Could not read this PDF. Remove password protection or paste the text.",
  });
}
