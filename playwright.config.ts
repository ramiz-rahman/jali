import { defineConfig } from "@playwright/test";
import { devServer } from "./e2e/fixtures/server";

const SCREENS = !!process.env.SCREENS;
// Jali's browser tests run against two example apps: Data Studio (the free workspace, the base URL) and Loan review
// (the curated page, `REVIEW_URL` in e2e/fixtures/app.ts). Point at other dev servers with DATA_STUDIO_URL and
// LOAN_REVIEW_URL; the defaults are their usual ports. The suite starts both servers itself and refuses a port someone
// else holds; REUSE_SERVER=1 runs against servers you started (e2e/fixtures/server.ts).
const STUDIO = process.env.DATA_STUDIO_URL ?? "http://localhost:5300";
const REVIEW = process.env.LOAN_REVIEW_URL ?? "http://localhost:5350";

// Normal runs (`pnpm test:e2e`) never write docs/screens. `pnpm screens` sets SCREENS=1 and runs the `screens`
// project, which re-runs the area specs with app.shot() enabled, plus screens.spec.ts (the shelf shots).
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  // Strict, so the tests never drift to another port while waiting.
  webServer: [devServer("examples/data-studio", STUDIO), devServer("examples/loan-review", REVIEW)],
  use: {
    channel: "chrome",
    baseURL: STUDIO,
    viewport: { width: 1600, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
    // Tests read end positions; reshapes slide (180ms) only when motion is allowed.
    reducedMotion: "reduce",
  },
  projects: SCREENS ? [{ name: "screens" }] : [{ name: "e2e", testIgnore: /screens\.spec\.ts/ }],
});
