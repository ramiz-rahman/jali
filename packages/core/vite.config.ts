import { defineConfig } from "vite-plus";

// `vp pack` builds the package for publishing: ESM, declarations and source maps.
//
// `layout` is a namespace (`export * as layout`). Bundled, it becomes an object of getters that an app's bundler
// can't tree-shake, so an app that calls `layout.resolve` would ship every layout operation. Built as a file of its
// own and re-exported from it, it stays an ES namespace (`export * as layout from "./layout.js"`), which bundlers
// tree-shake member by member. `dist/layout.js` is not an entry point of the package: `exports` doesn't list it.
const layoutNamespace = {
  name: "jali:layout-namespace",
  resolveId(id: string, importer?: string) {
    if (id === "./layout" && importer && /[\\/]src[\\/](index|adapter)\.(d\.)?ts$/.test(importer))
      return { id: "./layout.js", external: true };
  },
};

export default defineConfig({
  pack: {
    entry: {
      index: "src/index.ts",
      adapter: "src/adapter.ts",
      testing: "src/testing.ts",
      layout: "src/layout/index.ts",
    },
    format: "esm",
    dts: true,
    platform: "neutral",
    target: "es2022",
    sourcemap: true,
    clean: true,
    plugins: [layoutNamespace],
  },
});
