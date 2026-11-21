export function pdfFixture(pages) {
  const objects = [];
  const add = (s) => {
    objects.push(s);
    return objects.length;
  };
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(
    "<< /Type /Pages /Count " +
      pages.length +
      " /Kids [" +
      pages.map((_, i) => 4 + i * 2 + " 0 R").join(" ") +
      "] >>",
  );
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  for (const [i, text] of pages.entries()) {
    const content =
      "BT /F1 11 Tf 10 700 Td (" + text.replace(/[()\\]/g, "\\$&") + ") Tj ET";
    add(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 550 800] /Resources << /Font << /F1 3 0 R >> >> /Contents " +
        (5 + i * 2) +
        " 0 R >>",
    );
    add(
      "<< /Length " +
        content.length +
        " >>\nstream\n" +
        content +
        "\nendstream",
    );
  }
  let data = "%PDF-1.4\n";
  const positions = [0];
  for (const [i, s] of objects.entries()) {
    positions.push(data.length);
    data += i + 1 + " 0 obj\n" + s + "\nendobj\n";
  }
  const start = data.length;
  data +=
    "xref\n0 " +
    positions.length +
    "\n0000000000 65535 f \n" +
    positions
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("") +
    "trailer\n<< /Size " +
    positions.length +
    " /Root 1 0 R >>\nstartxref\n" +
    start +
    "\n%%EOF";
  return Buffer.from(data, "ascii");
}
