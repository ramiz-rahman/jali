import { defineConfig, defaultClientConditions } from "vite-plus";
import react from "@vitejs/plugin-react";

// Resolves @jali/* to the packages' source ("source" condition), as the lab does.
export default defineConfig({
  root: __dirname,
  // "./": every asset is linked relative to the page, so the built site works from any path. The layout lives in
  // the query string, which any path keeps.
  base: "./",
  // Its own dependency cache, so it can run beside the lab's dev server without invalidating that one's.
  cacheDir: "../../node_modules/.vite-example-trips",
  plugins: [react()],
  resolve: { conditions: ["source", ...defaultClientConditions] },
  // React, Jali, MapLibre and the app: MapLibre alone is most of it. A demo has no routes to split by.
  build: { chunkSizeWarningLimit: 1600 },
  server: { port: 5340 },
  preview: { port: 5340 },
});
