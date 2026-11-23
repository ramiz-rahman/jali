/**
 * The browsers every Playwright suite runs in, as projects: installed Chrome, and WebKit, Safari's engine as Playwright
 * builds it (`pnpm exec playwright install webkit`). `--project chrome` or `--project webkit` runs one of them.
 * `chrome` and `webkit` take what only that browser is given: Chrome's flags and permissions, which WebKit refuses.
 */
import type { PlaywrightTestProject } from "@playwright/test";

type Use = PlaywrightTestProject["use"];

/**
 * How many tests every suite runs at once, each in its own browser context. Four held with no failure or flake over
 * the root suite three times in Chrome and twice in WebKit, and every example suite twice in both (2026-11-23); one at
 * a time took about 2.5 times as long. `--workers=1` runs a suite one test at a time, to debug one.
 */
export const WORKERS = 4;

export const browsers = ({ chrome, webkit }: { chrome?: Use; webkit?: Use } = {}) => [
  { name: "chrome", use: { channel: "chrome", ...chrome } },
  { name: "webkit", use: { browserName: "webkit" as const, ...webkit } },
];
