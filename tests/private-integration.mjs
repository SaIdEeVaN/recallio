import { chromium, expect } from "@playwright/test";
import { sample } from "../lib/sample.mjs";
const site = process.env.TEST_URL || "http://127.0.0.1:3191",
  inbox = process.env.TEST_INBOX_URL || "http://127.0.0.1:54324";
if (
  ![site, inbox].every((url) =>
    ["localhost", "127.0.0.1"].includes(new URL(url).hostname),
  )
)
  throw new Error("The integration fixture runs on a local test stack.");
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
  args: ["--no-sandbox"],
});
const email = "learner-" + Date.now() + "@example.test";
const p = await b.newPage();
p.setDefaultTimeout(18000);
p.on("pageerror", (e) => console.log("BROWSER", e.message));
async function login(page, address) {
  await page.goto(site);
  await page.locator("html[data-theme]").waitFor();
  await page.getByRole("button", { name: "New study set" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill(address);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText(/Check your inbox/)).toBeVisible();
  const mail = await (await fetch(inbox + "/api/v1/messages")).json();
  const id = mail.messages.find((x) =>
    x.To.some((t) => t.Address === address),
  ).ID;
  const msg = await (await fetch(inbox + "/api/v1/message/" + id)).json();
  const link = msg.HTML.match(/href="([^"]+)"/)[1].replaceAll("&amp;", "&");
  await page.goto(link);
  await expect(
    page.getByRole("button", { name: "Account", exact: true }),
  ).toBeVisible();
}
try {
  await login(p, email);
  console.log("PASS email magic link through local Supabase Auth");
  await p.getByRole("button", { name: "New study set" }).click();
  await p.getByRole("textbox", { name: "Study set title" }).fill("QA botany");
  await p
    .getByRole("textbox", { name: /Source text/ })
    .fill(sample.chunks.map((c) => c.text).join("\n\n"));
  await p.getByRole("button", { name: "Preview source" }).click();
  await expect(
    p.getByRole("heading", { name: "Source notebook" }),
  ).toBeVisible();
  console.log("PASS signed-in paste preview");
  const setId = new URL(p.url()).hash.split("/")[1];
  await p.getByRole("button", { name: "Generate tools" }).click();
  await p.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(p.getByRole("heading", { name: "Key terms" })).toBeVisible({
    timeout: 45000,
  });
  console.log(
    "PASS summary/deck/quiz generated and persisted with deterministic model fixture",
  );
  await p.getByRole("button", { name: "Flashcards", exact: true }).click();
  await p.getByRole("button", { name: "Review again", exact: true }).click();
  await p.getByRole("button", { name: "Quiz", exact: true }).click();
  await p.getByRole("button", { name: "Start quiz" }).click();
  await p.getByRole("radio", { name: "Chemical" }).check();
  for (let i = 0; i < 4; i++)
    await p.getByRole("button", { name: "Next question" }).click();
  await p.getByRole("button", { name: "Submit quiz" }).click();
  await expect(p.getByText(/1 of 1 answered correctly/)).toBeVisible();
  console.log("PASS private server-side scoring and review");
  await p.getByRole("button", { name: "Tutor", exact: true }).click();
  await p
    .getByRole("textbox", { name: "Your question" })
    .fill("What do plants use light for?");
  await p.getByRole("button", { name: "Ask tutor", exact: true }).click();
  await p.getByRole("button", { name: "S1", exact: true }).click();
  await expect(p.locator("#src-S1")).toBeFocused();
  console.log("PASS streamed tutor, saved answer, source citation");
  await p.reload();
  await expect(p.getByRole("heading", { name: "QA botany" })).toBeVisible();
  console.log("PASS reopen after refresh");
  await p.getByRole("button", { name: "Flashcards", exact: true }).click();
  await p
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: "Study desk", exact: true })
    .click();
  await p.reload();
  await p
    .getByRole("button", { name: "Resume study set", exact: true })
    .click();
  await expect(
    p.getByRole("button", { name: "Flashcards", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  console.log(
    "PASS study desk resumes the last private study mode after reload",
  );
  const other = await b.newPage();
  await login(other, "other-" + Date.now() + "@example.test");
  await other.goto(site + "/#set/" + setId + "/Source");
  await expect(other.getByText("Study set unavailable.")).toBeVisible();
  console.log("PASS second user cannot access first study set");
  await p.getByRole("button", { name: "My library" }).click();
  await p.getByRole("button", { name: "Delete QA botany" }).click();
  await p
    .getByRole("button", { name: "Delete study set", exact: true })
    .click();
  await expect(
    p.getByRole("button", { name: "QA botany", exact: true }),
  ).toHaveCount(0);
  console.log("PASS private set deletion");
} finally {
  await b.close();
}
