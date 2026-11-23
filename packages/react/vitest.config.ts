import {
  defineConfig,
  defaultClientConditions,
  defaultServerConditions,
  lazyPlugins,
} from "vite-plus";
import react from "@vitejs/plugin-react";

// @jali/react's tests (`vp test run` at the root runs them as the "react" project): tests/, and src/bundle.test.ts.
// Every test that renders or defines a pane is here; none imports an example app (the apps' own suites test them).
// A test that needs a whole instance uses core's fixture (packages/core/tests/fixtures/workspace.ts). The packages
// resolve to their source, never a stale dist/.
export default defineConfig({
  root: import.meta.dirname,
  plugins: lazyPlugins(() => [react()]),
  resolve: { conditions: ["source", ...defaultClientConditions] },
  ssr: { resolve: { conditions: ["source", ...defaultServerConditions] } },
  test: {
    name: "react",
    globals: true,
    // Vitest's 5 s default fails a test that is only slow because the machine is busy, and an async test that
    // times out leaves its work running into the tests after it. These tests check counts and orders, not time, so
    // the limit only ends a hang.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
  },
} as any);
