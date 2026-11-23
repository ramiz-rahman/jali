import { defineConfig } from "@playwright/test";
import { browsers } from "../../e2e/fixtures/browsers";
import { devServer } from "../../e2e/fixtures/server";

// The trips example's own smoke test, against a server it starts itself on :5340, or on TRIPS_URL's port. It never
// reuses a server it didn't start unless REUSE_SERVER=1 (e2e/fixtures/server.ts).
// Run from the repository root: `pnpm exec playwright test -c examples/trips`.
const URL = process.env.TRIPS_URL ?? "http://localhost:5340";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  webServer: devServer("examples/trips", URL),
  use: {
    baseURL: URL,
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  },
  projects: browsers(),
});
