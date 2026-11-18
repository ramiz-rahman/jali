import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: "esm",
  dts: true,
  platform: "neutral",
  target: "es2022",
  sourcemap: true,
  clean: true,
  deps: { neverBundle: [/^@jali\/core/, /^react/, "lucide-react"] },
  onSuccess: "node scripts/build-css.mjs",
});
