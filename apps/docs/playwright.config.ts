import { defineConfig } from "@playwright/test";
import { REUSE_SERVER, portOf } from "../../e2e/fixtures/server";
import type { PlatformOptions } from "./e2e/platform";

// The docs' own browser tests, against the built site: `astro build`, then `astro preview` serves dist/ (what readers
// and search engines get). Run from the repository root: `pnpm exec playwright test -c apps/docs`.
// - DOCS_URL picks the port (default :5400). The suite starts its own server there and refuses a port someone else
//   holds; REUSE_SERVER=1 runs against a server you started yourself on that URL, a dev server included.
// - DOCS_BUILT=1 skips the build and serves the dist/ already there (`pnpm verify` builds it once, as its own gate).
// `--ignore-lock` keeps the server in the foreground: when Astro 7 detects a coding agent, `astro dev` and `astro
// preview` otherwise start in the background and exit at once, and Playwright reports "exited early". It also lets
// this server run beside another session's. The port is strict through `vite.preview.strictPort` in astro.config.mjs
// (Astro takes no --strictPort flag).
const URL = process.env.DOCS_URL ?? "http://localhost:5400";
const build = process.env.DOCS_BUILT === "1" ? "" : "pnpm exec astro build && ";

// The prerendered HTML is the same for everyone, so it must hydrate for Mac and non-Mac readers alike (C14 in
// docs/reviews/QUALITY-REVIEW.md): the smoke test runs once with each `navigator.platform` (e2e/platform.ts).
const chrome = (os: string) =>
  `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36`;
const mac = { platform: "MacIntel", userAgent: chrome("Macintosh; Intel Mac OS X 10_15_7") };
const windows = { platform: "Win32", userAgent: chrome("Windows NT 10.0; Win64; x64") };

export default defineConfig<PlatformOptions>({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  webServer: {
    command: `${build}pnpm exec astro preview --port ${portOf(URL)} --ignore-lock`,
    url: URL,
    reuseExistingServer: REUSE_SERVER,
    timeout: 180_000,
  },
  use: {
    baseURL: URL,
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: "mac", use: { channel: "chrome", ...mac } },
    // Only the smoke test: the tour reads the same page either way.
    { name: "windows", use: { channel: "chrome", ...windows }, testMatch: /smoke\.spec\.ts/ },
    // Safari's engine, with its own user agent: a Mac reader in Safari.
    { name: "webkit", use: { browserName: "webkit", platform: "MacIntel" } },
  ],
});
