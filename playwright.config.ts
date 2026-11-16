import { defineConfig } from "@playwright/test";

// The dev server is started separately (pnpm dev, port 5300).
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    channel: "chrome",
    baseURL: "http://localhost:5300",
    viewport: { width: 1600, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  },
});
