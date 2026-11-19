import { defineConfig } from "@playwright/test";

// The trips example's own smoke test, against its own server (never the lab's). Port 5340 by default; another
// session may hold it, so TRIPS_URL points at whichever port `pnpm example:trips` printed.
// Run from the repository root: `pnpm exec playwright test -c examples/trips`.
const URL = process.env.TRIPS_URL ?? "http://localhost:5340";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  webServer: {
    command: "pnpm example:trips",
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
