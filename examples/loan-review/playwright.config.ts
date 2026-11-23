import { defineConfig } from "@playwright/test";
import { browsers, WORKERS } from "../../e2e/fixtures/browsers";
import { devServer } from "../../e2e/fixtures/server";

// Loan review's own browser tests: the standard's checks on every view and in Split view, against a server it starts
// itself on :5350, or on LOAN_REVIEW_URL's port. It never reuses a server it didn't start unless REUSE_SERVER=1
// (e2e/fixtures/server.ts). Jali's own browser tests (e2e/ at the root) also run against this app.
// Run from the repository root: `pnpm exec playwright test -c examples/loan-review`.
const URL = process.env.LOAN_REVIEW_URL ?? "http://localhost:5350";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  workers: WORKERS,
  reporter: [["list"]],
  webServer: devServer("examples/loan-review", URL),
  use: {
    baseURL: URL,
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  },
  projects: browsers(),
});
