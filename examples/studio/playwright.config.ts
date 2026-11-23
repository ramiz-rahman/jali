import { defineConfig } from "@playwright/test";
import { browsers } from "../../e2e/fixtures/browsers";
import { devServer } from "../../e2e/fixtures/server";

// The studio example's own smoke test, against a server it starts itself on :5330, or on STUDIO_URL's port. It never
// reuses a server it didn't start unless REUSE_SERVER=1 (e2e/fixtures/server.ts).
// Run from the repository root: `pnpm exec playwright test -c examples/studio`.
// SCREENS=1 also writes the screenshots in screens/ (e2e/screens.spec.ts).
const URL = process.env.STUDIO_URL ?? "http://localhost:5330";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  webServer: devServer("examples/studio", URL),
  use: {
    baseURL: URL,
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  },
  // Installed Chrome, as the repository's other Playwright configs use, and WebKit. The sessions are MP3, which
  // Playwright's own Chromium builds decode too (scripts/audio/checks/decode.txt); the build this Playwright version
  // wants is not installed on every machine, so the tests don't depend on it.
  projects: browsers({
    chrome: { launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] } },
  }),
});
