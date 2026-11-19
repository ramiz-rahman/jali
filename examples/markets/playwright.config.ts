import { defineConfig } from "@playwright/test";

// The markets example's own smoke test, against its own server on :5320 (never the lab's).
// Run from the repository root: `pnpm exec playwright test -c examples/markets`.
const URL = process.env.MARKETS_URL ?? "http://localhost:5320";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  webServer: {
    command: "pnpm example:markets",
    cwd: "../..",
    url: URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: {
    channel: "chrome",
    baseURL: URL,
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  },
});
