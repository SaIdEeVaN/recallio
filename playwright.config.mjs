import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  timeout: 35000,
  use: {
    baseURL: process.env.TEST_URL || "http://127.0.0.1:3180",
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },
  webServer: process.env.TEST_URL
    ? undefined
    : {
        command: "npm run start -- --port 3180",
        url: "http://127.0.0.1:3180",
        reuseExistingServer: !process.env.CI,
      },
});
