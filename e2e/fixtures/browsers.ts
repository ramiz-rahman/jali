/**
 * The browsers every Playwright suite runs in, as projects: installed Chrome, and WebKit, Safari's engine as Playwright
 * builds it (`pnpm exec playwright install webkit`). `--project chrome` or `--project webkit` runs one of them.
 * `chrome` and `webkit` take what only that browser is given: Chrome's flags and permissions, which WebKit refuses.
 */
import type { PlaywrightTestProject } from "@playwright/test";

type Use = PlaywrightTestProject["use"];

export const browsers = ({ chrome, webkit }: { chrome?: Use; webkit?: Use } = {}) => [
  { name: "chrome", use: { channel: "chrome", ...chrome } },
  { name: "webkit", use: { browserName: "webkit" as const, ...webkit } },
];
