import { expect, test } from "@playwright/test";

async function mockProviders(page, google) {
  await page.route("**/auth/v1/settings", (route) =>
    route.fulfill({
      headers: { "Access-Control-Allow-Origin": "*" },
      json: { external: { google, email: true } },
    }),
  );
}

test("Google sign-in appears when enabled and sends the browser through Supabase", async ({
  page,
}) => {
  await mockProviders(page, true);
  await page.route("**/auth/v1/authorize?*", async (route) => {
    const origin = new URL(page.url()).origin;
    const url = new URL(route.request().url());
    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("redirect_to")).toBe(origin);
    await route.fulfill({
      status: 302,
      headers: {
        location:
          origin +
          "/#error=access_denied&error_code=access_denied&error_description=provider_detail",
      },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "New study set" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Email me a sign-in link" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Continue with Google" }).click();
  await expect(dialog.getByRole("status")).toHaveText(
    "Sign-in was canceled or expired. Please try again.",
  );
  await expect(
    dialog.getByRole("button", { name: "Continue with Google" }),
  ).toBeEnabled();
  expect(new URL(page.url()).hash).toBe("");
});

test("email sign-in stays available when the Google provider is disabled", async ({
  page,
}) => {
  await mockProviders(page, false);
  await page.goto("/");
  const settings = page.waitForResponse("**/auth/v1/settings");
  await page.getByRole("button", { name: "New study set" }).click();
  expect((await settings).ok()).toBe(true);
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Email me a sign-in link" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Continue with Google" }),
  ).toHaveCount(0);
});
