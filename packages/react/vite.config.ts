import { defineConfig } from "vite-plus";

// `vp pack` builds the package for publishing. Core and React stay imports; the CSS is built after.
// Two entries: index, and icons (Jali's default icons, to spread under a host's own). Every chunk starts with
// "use client": the components use state and context, so a React Server Components host (Next.js's App Router) must
// load them on the client, and can import them straight from a server component.
export default defineConfig({
  pack: {
    entry: { index: "src/index.ts", icons: "src/icons.ts" },
    format: "esm",
    dts: true,
    platform: "neutral",
    target: "es2022",
    sourcemap: true,
    banner: { js: '"use client";' },
    clean: true,
    deps: { neverBundle: [/^@jali\/core/, /^react/] },
    onSuccess: "node scripts/build-css.mjs",
  },
});
