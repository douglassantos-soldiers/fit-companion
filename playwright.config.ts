import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["E2E_BASE_URL"] ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  workers: process.env["CI"] ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env["E2E_SKIP_WEBSERVER"]
    ? undefined
    : {
        // vite preview expects dist/server which nitro may not emit; use Vite dev for smoke.
        command: "npm run dev -- --host 127.0.0.1 --port 3000",
        url: baseURL,
        reuseExistingServer: !process.env["CI"],
        timeout: 180_000,
      },
});
