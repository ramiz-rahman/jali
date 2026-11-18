/**
 * Runs the reference coverage test, which the repo's root config does not include (its `include` covers the lab's
 * src/ and packages/ only). From the repo root:
 *   npx vitest run --config apps/docs/src/reference/vitest.config.ts
 */
import { fileURLToPath } from "node:url";
import { defineConfig, defaultClientConditions } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("../../../..", import.meta.url)),
  resolve: { conditions: ["source", ...defaultClientConditions] },
  test: { include: ["apps/docs/src/reference/**/*.test.ts"], environment: "jsdom" },
} as never);
