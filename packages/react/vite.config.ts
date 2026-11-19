import { defineConfig } from "vite-plus";

// `vp pack` builds the package for publishing. Core, React and the icons stay imports; the CSS is built after.
export default defineConfig({
  pack: {
    entry: { index: "src/index.ts" },
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
