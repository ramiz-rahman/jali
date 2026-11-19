import { defineConfig } from "@playwright/test";

// The studio example's own smoke test, against its own server on :5330 (never the lab's).
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
    // Real Chrome: it decodes the AAC clips (Playwright's own Chromium doesn't).
    channel: "chrome",
    baseURL: URL,
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
  },
});
