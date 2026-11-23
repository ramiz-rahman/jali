import { defineConfig } from "@playwright/test";
import { browsers, WORKERS } from "../../e2e/fixtures/browsers";
import { devServer } from "../../e2e/fixtures/server";

// Data Studio's own browser tests: the standard's checks on every preset, against a server it starts itself on :5300,
// or on DATA_STUDIO_URL's port. It never reuses a server it didn't start unless REUSE_SERVER=1
// (e2e/fixtures/server.ts). Jali's own browser tests (e2e/ at the root) also run against this app.
// Run from the repository root: `pnpm exec playwright test -c examples/data-studio`.
const URL = process.env.DATA_STUDIO_URL ?? "http://localhost:5300";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  workers: WORKERS,
  reporter: [["list"]],
  webServer: devServer("examples/data-studio", URL),
  use: {
    baseURL: URL,
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  },
  projects: browsers(),
});
