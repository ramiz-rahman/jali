import { defineConfig } from "@playwright/test";
import { browsers, WORKERS } from "../fixtures/browsers";
import { REUSE_SERVER, portOf } from "../fixtures/server";

// The public site as Netlify serves it: the docs and every hosted example, built into site/ (tooling/build-site.mjs)
// and served with Netlify's address rules (tooling/serve-site.mjs). Run from the repository root:
// `pnpm exec playwright test -c e2e/site`. SITE_BUILT=1 serves the site/ already there instead of building it.
const URL = process.env.SITE_URL ?? "http://localhost:5480";
const build = process.env.SITE_BUILT === "1" ? "" : "node tooling/build-site.mjs && ";

export default defineConfig({
  testDir: ".",
  timeout: 90_000,
  workers: WORKERS,
  reporter: [["list"]],
  webServer: {
    command: `${build}node tooling/serve-site.mjs --port=${portOf(URL)}`,
    cwd: new globalThis.URL("../..", import.meta.url).pathname,
    url: URL,
    reuseExistingServer: REUSE_SERVER,
    timeout: 300_000,
  },
  use: { baseURL: URL, viewport: { width: 1440, height: 900 } },
  projects: browsers(),
});
