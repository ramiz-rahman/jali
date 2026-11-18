import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts", adapter: "src/adapter.ts" },
  format: "esm",
  dts: true,
  platform: "neutral",
  target: "es2022",
  sourcemap: true,
  clean: true,
});
