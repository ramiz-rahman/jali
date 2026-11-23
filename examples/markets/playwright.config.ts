import { defineConfig } from "@playwright/test";
import { browsers, WORKERS } from "../../e2e/fixtures/browsers";
import { devServer } from "../../e2e/fixtures/server";

// The markets example's own smoke test, against a server it starts itself on :5320, or on MARKETS_URL's port. It never
// reuses a server it didn't start unless REUSE_SERVER=1 (e2e/fixtures/server.ts).
// Run from the repository root: `pnpm exec playwright test -c examples/markets`.
const URL = process.env.MARKETS_URL ?? "http://localhost:5320";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: WORKERS,
  reporter: [["list"]],
  webServer: devServer("examples/markets", URL),
  use: {
    baseURL: URL,
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  },
  projects: browsers(),
});
