import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("sample supports cited reading, edited cards, persistent review and server-scored quizzes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample" }).click();
  await page.getByRole("button", { name: "S2", exact: true }).first().click();
  await expect(page.locator("#src-S2")).toBeFocused();
  await page.getByRole("button", { name: "Flashcards", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "Source excerpt" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Reveal answer" }).click();
  const excerpt = page.getByRole("complementary", { name: "Source excerpt" });
  await expect(excerpt).toContainText("From light to chemical energy");
  await expect(
    page.getByRole("button", { name: "Show question" }),
  ).toContainText("chloroplasts");
  await excerpt.getByRole("button", { name: "Open source section" }).click();
  await expect(page.locator("#src-S1")).toBeFocused();
  await page.getByRole("button", { name: "Flashcards", exact: true }).click();
  await page.getByRole("button", { name: "Review again", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Front", exact: true })
    .fill("Which colors are absorbed?");
  await page.getByRole("button", { name: "Save card" }).click();
  await expect(
    page.getByRole("button", { name: "Reveal answer" }),
  ).toContainText("Which colors");
  await page.reload();
  await page.getByRole("button", { name: /Review queue/ }).click();
  await page.getByRole("button", { name: "Review cards" }).click();
  await expect(
    page.getByRole("button", { name: "Reveal answer" }),
  ).toContainText("Where does photosynthesis");
  await page.getByRole("button", { name: "Quiz", exact: true }).click();
  await page.getByRole("button", { name: "Start quiz" }).click();
  await page.getByLabel("Chemical", { exact: true }).check();
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "Submit quiz" }).click();
  await expect(
    page.getByText(/1 of 1 answered correctly · 4 unanswered/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry missed" }).click();
  await expect(page.getByText("Question 1 of 4")).toBeVisible();
  await page.getByRole("button", { name: "Tutor", exact: true }).click();
  await page.getByRole("button", { name: "Why do leaves look green?" }).click();
  await page.getByRole("button", { name: "S2", exact: true }).click();
  await expect(page.locator("#src-S2")).toBeFocused();
});
test("360px mobile navigation, dark theme and sign-in dialog work with keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Study desk", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Dark theme" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await page
    .getByRole("navigation", { name: "Mobile workspace" })
    .getByRole("button", { name: "My library" })
    .click();
  await page.getByRole("button", { name: "New study set" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
test("landing and sample workspace accessibility scan", async ({ page }) => {
  await page.goto("/");
  for (const mode of ["desk", "summary"]) {
    if (mode === "summary")
      await page.getByRole("button", { name: "Explore sample" }).click();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations.map((v) => v.id + ": " + v.help)).toEqual([]);
  }
});
test("anonymous requests cannot access private study sets or generate tools", async ({
  page,
}) => {
  await page.goto("/");
  for (const action of ["open", "generate", "list", "delete"]) {
    const status = await page.evaluate(async (action) => {
      const response = await fetch("/api/study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id: "9ac1031f-22b3-4b57-9630-d651af8f20b0",
        }),
      });
      return response.status;
    }, action);
    expect(status).toBe(401);
  }
});
