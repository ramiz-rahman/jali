import { defineConfig } from "@playwright/test";

// The docs' own browser tests, against a docs dev server (the root config points at the example apps).
// Point at another server with DOCS_URL, e.g. DOCS_URL=http://localhost:5421 pnpm exec playwright test -c apps/docs.
const URL = process.env.DOCS_URL ?? "http://localhost:5400";
const port = new globalThis.URL(URL).port || "5400";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  webServer: {
    command: `JALI_DOCS_CACHE=node_modules/.vite-e2e pnpm exec vp dev --port ${port} --strictPort`,
    url: URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: {
    channel: "chrome",
    baseURL: URL,
    viewport: { width: 1440, height: 900 },
  },
});
