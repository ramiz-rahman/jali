import { defineConfig, defaultClientConditions, defaultServerConditions } from "vite-plus";

// @jali/core's unit tests (`vp test run` at the root runs them as the "core" project): tests/, and the layout tree's
// own beside its source (src/layout/test/). They import @jali/core and nothing of React; a test that renders, or
// defines a pane with @jali/react, is in packages/react/tests. The engine tests that need a whole instance (a data
// browser's kinds and a curated page) share tests/fixtures/workspace.ts, plain kinds the package owns. The package
// resolves to its source, never a stale dist/.
export default defineConfig({
  root: import.meta.dirname,
  resolve: { conditions: ["source", ...defaultClientConditions] },
  ssr: { resolve: { conditions: ["source", ...defaultServerConditions] } },
  test: {
    name: "core",
    globals: true,
    // Vitest's 5 s default fails a test that is only slow because the machine is busy, and an async test that
    // times out leaves its work running into the tests after it. These tests check counts and orders, not time, so
    // the limit only ends a hang.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
  },
} as any);
