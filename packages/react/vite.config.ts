import { defineConfig } from "vite-plus";

// `vp pack` builds the package for publishing. Core, React and Phosphor stay imports; the CSS is built after.
// Three entries: index (Phosphor's icons by default), bare (no Phosphor; the host passes every icon) and icons.
export default defineConfig({
  pack: {
    entry: { index: "src/index.ts", bare: "src/bare.ts", icons: "src/icons.ts" },
    format: "esm",
    dts: true,
    platform: "neutral",
    target: "es2022",
    sourcemap: true,
    clean: true,
    deps: { neverBundle: [/^@jali\/core/, /^react/, /^@phosphor-icons\/react/] },
    onSuccess: "node scripts/build-css.mjs",
  },
});
