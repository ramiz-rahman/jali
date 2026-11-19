import { defineConfig, defaultClientConditions, lazyPlugins } from "vite-plus";
import react from "@vitejs/plugin-react";
export default defineConfig({
  // The root serves no app: each example has its own config (`vp dev examples/<name>`). This one holds the
  // formatter, the linter and the unit tests, which resolve the packages to their source.
  plugins: lazyPlugins(() => [react()]),
  resolve: { conditions: ["source", ...defaultClientConditions] },
  // MDX is left as written: the formatter reflows JSX children and breaks fenced code inside components. So is the
  // Markdown scripts/agent-docs.mjs writes from it, which its --check compares byte for byte.
  fmt: { ignorePatterns: ["**/*.mdx", "packages/core/docs/**"] },
  // Docs samples show a value on its own line ("keymap.label(id); // \"⌘K ⌘↵\""), on purpose.
  lint: {
    overrides: [{ files: ["apps/docs/src/samples/**"], rules: { "no-unused-expressions": "off" } }],
  },
  test: {
    globals: true,
    include: [
      "tests/**/*.test.{ts,tsx}",
      "packages/*/src/**/*.test.{ts,tsx}",
      "examples/*/src/**/*.test.{ts,tsx}",
    ],
    environment: "jsdom",
    exclude: ["e2e/**", "node_modules/**"],
  },
} as any);
