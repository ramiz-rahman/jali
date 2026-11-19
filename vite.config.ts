import { defineConfig, defaultClientConditions, lazyPlugins } from "vite-plus";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: lazyPlugins(() => [react()]),
  // The packages resolve to their source (the "source" export condition), so the lab runs them without a build.
  resolve: { conditions: ["source", ...defaultClientConditions] },
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  // MDX is left as written: the formatter reflows JSX children and breaks fenced code inside components.
  fmt: { ignorePatterns: ["**/*.mdx"] },
  // Docs samples show a value on its own line ("keymap.label(id); // \"⌘K ⌘↵\""), on purpose.
  lint: {
    overrides: [{ files: ["apps/docs/src/samples/**"], rules: { "no-unused-expressions": "off" } }],
  },
  test: {
    globals: true,
    include: [
      "src/**/*.test.{ts,tsx}",
      "packages/*/src/**/*.test.{ts,tsx}",
      "examples/*/src/**/*.test.{ts,tsx}",
    ],
    environment: "jsdom",
    exclude: ["e2e/**", "node_modules/**"],
  },
} as any);
