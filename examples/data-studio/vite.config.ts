import { defineConfig, defaultClientConditions } from "vite-plus";
import react from "@vitejs/plugin-react";

// Resolves @jali/* to the packages' source ("source" condition), so the app runs them without a build.
export default defineConfig({
  root: __dirname,
  // "./": every asset is linked relative to the page, so the built site works from any path. The layout lives in
  // the query string, which any path keeps.
  base: "./",
  // Its own dependency cache, so it can run beside the other examples' dev servers.
  cacheDir: "../../node_modules/.vite-example-data-studio",
  plugins: [react()],
  resolve: { conditions: ["source", ...defaultClientConditions] },
  // PGlite loads its WebAssembly and data files itself; pre-bundling breaks their URLs.
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  // Not strict: when another checkout already holds 5300, `vp dev` takes the next free port and prints it.
  server: { port: 5300 },
  preview: { port: 5300 },
});
