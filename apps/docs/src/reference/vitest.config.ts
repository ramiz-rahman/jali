/**
 * Runs the reference coverage test, which the repo's root config does not include (its projects cover the packages'
 * tests and the examples' only). From the repo root:
 *   pnpm exec vp test run --config apps/docs/src/reference/vitest.config.ts
 */
import { fileURLToPath } from "node:url";
import { defineConfig, defaultClientConditions } from "vite-plus";

export default defineConfig({
  root: fileURLToPath(new URL("../../../..", import.meta.url)),
  resolve: { conditions: ["source", ...defaultClientConditions] },
  test: { include: ["apps/docs/src/reference/**/*.test.ts"], environment: "jsdom" },
} as never);
