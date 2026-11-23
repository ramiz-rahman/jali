import { defineConfig } from "@playwright/test";
import { browsers, WORKERS } from "../../e2e/fixtures/browsers";
import { devServer } from "../../e2e/fixtures/server";

// The handshake example's own browser tests, against a server it starts itself on :5360, or on HANDSHAKE_URL's
// port. Run from the repository root: `pnpm exec playwright test -c examples/handshake`.
const URL = process.env.HANDSHAKE_URL ?? "http://localhost:5360";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: WORKERS,
  reporter: [["list"]],
  webServer: devServer("examples/handshake", URL),
  use: {
    baseURL: URL,
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  },
  projects: browsers(),
});
