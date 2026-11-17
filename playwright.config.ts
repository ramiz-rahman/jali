import { defineConfig } from "@playwright/test";

const SCREENS = !!process.env.SCREENS;

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
    url: "http://localhost:5300",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: {
    channel: "chrome",
    baseURL: "http://localhost:5300",
    viewport: { width: 1600, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: SCREENS
    ? [{ name: "screens" }]
    : [{ name: "e2e", testIgnore: /screens\.spec\.ts/ }],
});
