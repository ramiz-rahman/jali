import { defineConfig, defaultClientConditions } from "vite-plus";
import react from "@vitejs/plugin-react";

// Resolves jali to the packages' source ("source" condition), as the other examples do.
export default defineConfig({
  root: __dirname,
  // "./": every asset is linked relative to the page, the audio clips too, so the built site works from any path.
  // The layout lives in the query string, which any path keeps.
  base: "./",
  // Its own dependency cache, so it can run beside the other examples' dev servers.
  cacheDir: "../../node_modules/.vite-example-studio",
  plugins: [react()],
  resolve: { conditions: ["source", ...defaultClientConditions] },
  // React, Jali and the app in one file. A demo has no routes to split by.
  build: { chunkSizeWarningLimit: 700 },
  server: { port: 5330 },
  preview: { port: 5330 },
});
