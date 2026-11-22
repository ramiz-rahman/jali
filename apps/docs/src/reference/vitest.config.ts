/**
 * Runs the docs' own tests, which the repo's root config does not include (its projects cover the packages' tests and
 * the examples' only): the reference coverage and Markdown tests, and the test files the guides show (the testing
 * guide's, src/samples/guides/testing), so a test a reader copies is one that passes. From the repo root:
 *   pnpm exec vp test run --config apps/docs/src/reference/vitest.config.ts
 */
import { fileURLToPath } from "node:url";
import { defineConfig, defaultClientConditions } from "vite-plus";

export default defineConfig({
  root: fileURLToPath(new URL("../../../..", import.meta.url)),
  resolve: { conditions: ["source", ...defaultClientConditions] },
  test: { include: ["apps/docs/src/reference/**/*.test.ts", "apps/docs/src/samples/**/*.test.ts"], environment: "jsdom" },
} as never);
