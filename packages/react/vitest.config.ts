import {
  defineConfig,
  defaultClientConditions,
  defaultServerConditions,
  lazyPlugins,
} from "vite-plus";
import react from "@vitejs/plugin-react";

// @jali/react's unit tests (`vp test run` at the root runs them as the "react" project): tests/, and src/bundle.test.ts.
// Every test that renders or defines a pane is here, the engine tests that run against Data Studio's and Loan review's
// kinds (tests/workspace.ts) among them. The packages resolve to their source, never a stale dist/.
export default defineConfig({
  root: import.meta.dirname,
  plugins: lazyPlugins(() => [react()]),
  resolve: { conditions: ["source", ...defaultClientConditions] },
  ssr: { resolve: { conditions: ["source", ...defaultServerConditions] } },
  test: {
    name: "react",
    globals: true,
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
  },
} as any);
