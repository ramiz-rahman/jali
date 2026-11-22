import {
  defineConfig,
  defaultClientConditions,
  defaultServerConditions,
  lazyPlugins,
} from "vite-plus";
import react from "@vitejs/plugin-react";

// @jali/react's tests (`vp test run` at the root runs them as the "react" project): tests/, and src/bundle.test.ts.
// Every test that renders or defines a pane is here. tests/examples/ is the suite that runs the engine against Data
// Studio's and Loan review's kinds (its fixture.ts); the rest use small kinds of their own. The packages resolve to
// their source, never a stale dist/.
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
