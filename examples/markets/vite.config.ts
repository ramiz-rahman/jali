import { defineConfig, defaultClientConditions } from "vite-plus";
import react from "@vitejs/plugin-react";

// Resolves jali to the packages' source ("source" condition), as the other examples do.
export default defineConfig({
  root: __dirname,
  // "./": every asset is linked relative to the page, so the built site works from any path
  // (example.com/, example.com/demos/markets/). The layout lives in the query string, which any path keeps.
  base: "./",
  // Its own dependency cache, so it can run beside the other examples' dev servers without invalidating theirs.
  cacheDir: "../../node_modules/.vite-example-markets",
  plugins: [react()],
  resolve: { conditions: ["source", ...defaultClientConditions] },
  // React, Jali and the app in one file: about 170 kB gzipped. A demo has no routes to split by.
  build: { chunkSizeWarningLimit: 700 },
  // Not strict: when another checkout already holds 5320, `vp dev` takes the next free port and prints it.
  server: { port: 5320 },
  preview: { port: 5320 },
});
