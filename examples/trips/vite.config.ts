import { defineConfig, defaultClientConditions } from "vite-plus";
import react from "@vitejs/plugin-react";

// Resolves @jali/* to the packages' source ("source" condition), as the other examples do.
export default defineConfig({
  root: __dirname,
  // "./": every asset is linked relative to the page, so the built site works from any path. The layout lives in
  // the query string, which any path keeps.
  base: "./",
  // Its own dependency cache, so it can run beside the other examples' dev servers without invalidating theirs.
  cacheDir: "../../node_modules/.vite-example-trips",
  plugins: [react()],
  resolve: { conditions: ["source", ...defaultClientConditions] },
  // React, Jali, MapLibre and the app in one file: about 480 kB gzipped, most of it MapLibre (its worker is a file
  // of its own). A demo has no routes to split by.
  build: { chunkSizeWarningLimit: 1800 },
  server: { port: 5340 },
  preview: { port: 5340 },
});
