import { defineConfig } from "@playwright/test";

// The studio example's own smoke test, against its own server on :5330 (never another example's).
// Run from the repository root: `pnpm exec playwright test -c examples/studio`.
// SCREENS=1 also writes the screenshots in screens/ (e2e/screens.spec.ts).
const URL = process.env.STUDIO_URL ?? "http://localhost:5330";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  webServer: {
    command: "vp dev examples/studio --strictPort",
    cwd: "../..",
    url: URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: {
    // Installed Chrome, as the repository's other Playwright configs use. The sessions are MP3, which Playwright's own
    // Chromium builds decode too (scripts/audio/checks/decode.txt); the build this Playwright version wants is not
    // installed on every machine, so the tests don't depend on it.
    channel: "chrome",
    baseURL: URL,
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
  },
});
