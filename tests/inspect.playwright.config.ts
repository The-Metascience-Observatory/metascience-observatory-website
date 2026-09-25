import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "inspect.browser.ts",
  workers: 1,
  timeout: 120000,
  use: { baseURL: process.env.INSPECT_TEST_BASE_URL || "http://127.0.0.1:3417", headless: true },
  webServer: process.env.INSPECT_TEST_BASE_URL ? undefined : {
    command: "npx next dev --port 3417",
    cwd: process.cwd(),
    url: "http://127.0.0.1:3417/birds-eye-reviews/long-covid",
    timeout: 180000,
    reuseExistingServer: false,
  },
  reporter: "list",
});
