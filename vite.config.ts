import {
  defineConfig,
  defaultClientConditions,
  defaultServerConditions,
  lazyPlugins,
} from "vite-plus";
import react from "@vitejs/plugin-react";
export default defineConfig({
  // The root serves no app: each example has its own config (`vp dev examples/<name>`). This one holds the
  // formatter, the linter and the unit tests' projects, which resolve the packages to their source.
  plugins: lazyPlugins(() => [react()]),
  resolve: { conditions: ["source", ...defaultClientConditions] },
  // Tests in the node environment (server rendering) resolve them the same way.
  ssr: { resolve: { conditions: ["source", ...defaultServerConditions] } },
  // MDX is left as written: the formatter reflows JSX children and breaks fenced code inside components. So is the
  // Markdown tooling/agent-docs.mjs writes from it, which its --check compares byte for byte.
  fmt: {
    ignorePatterns: [
      "**/*.mdx",
      "packages/core/docs/**",
      // Data kept exactly as fetched or generated: licence metadata, session transcripts, audio check reports.
      "examples/studio/licenses/**",
      "examples/studio/src/sessions/data/**",
      "examples/studio/scripts/audio/checks/**",
    ],
  },
  // Docs samples show a value on its own line ("keymap.label(id); // \"⌘K ⌘↵\""), on purpose.
  lint: {
    overrides: [{ files: ["apps/docs/src/samples/**"], rules: { "no-unused-expressions": "off" } }],
  },
  // `vp test run` runs every project: each package's own (packages/*/vitest.config.ts) and the examples' unit tests.
  test: {
    projects: [
      "packages/core/vitest.config.ts",
      "packages/react/vitest.config.ts",
      {
        extends: true,
        test: {
          name: "examples",
          globals: true,
          include: ["examples/*/src/**/*.test.{ts,tsx}"],
          environment: "jsdom",
        },
      },
    ],
  },
} as any);
