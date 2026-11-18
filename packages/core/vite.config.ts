import { defineConfig } from "vite-plus";

// `vp pack` builds the package for publishing: ESM, declarations and source maps.
export default defineConfig({
  pack: {
    entry: { index: "src/index.ts", adapter: "src/adapter.ts" },
    format: "esm",
    dts: true,
    platform: "neutral",
    target: "es2022",
    sourcemap: true,
    clean: true,
  },
});
