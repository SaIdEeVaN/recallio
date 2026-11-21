import http from "node:http";
import { sample } from "../lib/sample.mjs";
import { sampleQuestions } from "../lib/sample-key.mjs";
http
  .createServer(async (req, res) => {
    if (req.url === "/model") {
      let data = "";
      for await (const chunk of req) data += chunk;
      const b = JSON.parse(data),
        instructions = b.messages[0].content,
        sections = JSON.parse(b.messages[1].content).sections;
      const ref = sections[0].id;
      const fixture = instructions.includes("Produce cards")
        ? { cards: sample.cards.map((c) => ({ ...c, refs: [ref] })) }
        : instructions.includes("Produce quiz")
          ? { questions: sampleQuestions.map((q) => ({ ...q, refs: [ref] })) }
          : instructions.includes("Produce summary")
            ? {
                sections: sample.summary.sections.map((x) => ({
                  ...x,
                  refs: [ref],
                })),
                terms: sample.summary.terms.map((x) => ({ ...x, refs: [ref] })),
              }
            : {
                supported: true,
                evidence: [{ ref, quote: sections[0].text.slice(0, 32) }],
                answer: "Plants use light energy to make sugars.",
              };
      const str = JSON.stringify(fixture);
      if (b.stream) {
        res.setHeader("Content-Type", "text/event-stream");
        for (let i = 0; i < str.length; i += 20) {
          res.write(
            "data: " +
              JSON.stringify({
                choices: [{ delta: { content: str.slice(i, i + 20) } }],
              }) +
              "\n\n",
          );
        }
        res.end("data: [DONE]\n\n");
      } else
        res.end(JSON.stringify({ choices: [{ message: { content: str } }] }));
      return;
    }
    res.statusCode = 404;
    res.end();
  })
  .listen(3196, "127.0.0.1");
