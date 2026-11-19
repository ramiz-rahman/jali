import { defineConfig } from "vite-plus";

// `vp pack` builds the package for publishing. Core and React stay imports; the CSS is built after.
// Two entries: index, and icons (Jali's default icons, to spread under a host's own).
export default defineConfig({
  pack: {
    entry: { index: "src/index.ts", icons: "src/icons.ts" },
    format: "esm",
    dts: true,
    platform: "neutral",
    target: "es2022",
    sourcemap: true,
    clean: true,
    deps: { neverBundle: [/^@jali\/core/, /^react/] },
    onSuccess: "node scripts/build-css.mjs",
  },
});
