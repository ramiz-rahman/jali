import { defineConfig } from "@playwright/test";

const SCREENS = !!process.env.SCREENS;
// Point at another dev server with PANE_LAB_URL (e.g. a second `vite --port 5301`); the default is the usual :5300.
const URL = process.env.PANE_LAB_URL ?? "http://localhost:5300";

// Normal runs (`pnpm test:e2e`) never write docs/screens. `pnpm screens` sets SCREENS=1 and runs the `screens`
// project, which re-runs the area specs with lab.shot() enabled, plus screens.spec.ts (the shelf shots).
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  webServer: {
    command: "pnpm dev",
    url: URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: {
    channel: "chrome",
    baseURL: URL,
    viewport: { width: 1600, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
    // Tests read end positions; reshapes slide (180ms) only when motion is allowed.
    reducedMotion: "reduce",
  },
  projects: SCREENS
    ? [{ name: "screens" }]
    : [{ name: "e2e", testIgnore: /screens\.spec\.ts/ }],
});
