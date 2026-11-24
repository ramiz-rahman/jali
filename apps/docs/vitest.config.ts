/**
 * The docs' unit tests, which the repo's root config does not include (its projects are the packages' and the
 * examples'): the Markdown copies and search (src/site), the reference's coverage, and the test files the guides
 * show (src/samples), so a test a reader copies is one that passes. e2e/ holds the Playwright specs
 * (`pnpm exec playwright test -c apps/docs`). From the repo root:
 *   pnpm exec vp test run --config apps/docs/vitest.config.ts
 * The packages resolve to their source, as in the root config, never to a stale dist/.
 */
import { fileURLToPath } from "node:url";
import { defaultClientConditions, defineConfig } from "vite-plus";

export default defineConfig({
  // The tests' paths are apps/docs's, wherever the command runs.
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: { conditions: ["source", ...defaultClientConditions] },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
  },
} as never);
