import { defineConfig } from "vite-plus";

// `vp pack` builds the package for publishing. Core and React stay imports; the CSS is built after.
// Entries: index and internal, what packages/jali re-exports (the features, `definePage`). Every chunk starts with
// "use client": the components use state and context, so a React Server Components host (Next.js's App Router) must
// load them on the client, and can import them straight from a server component.
export default defineConfig({
  pack: {
    entry: { index: "src/index.ts", internal: "src/internal.ts" },
    format: "esm",
    dts: true,
    // The packages' own source: an example that can't emit declarations never breaks the build.
    tsconfig: "../../tsconfig.build.json",
    platform: "neutral",
    target: "es2022",
    sourcemap: true,
    banner: { js: '"use client";' },
    clean: true,
    deps: { neverBundle: [/^@jali\/core/, /^react/] },
    onSuccess: "node scripts/build-css.mjs",
  },
});
