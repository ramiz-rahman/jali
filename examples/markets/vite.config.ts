import { defineConfig, defaultClientConditions } from "vite-plus";
import react from "@vitejs/plugin-react";

// Resolves @jali/* to the packages' source ("source" condition), as the lab does.
export default defineConfig({
  root: __dirname,
  // "./": every asset is linked relative to the page, so the built site works from any path
  // (example.com/, example.com/demos/markets/). The layout lives in the query string, which any path keeps.
  base: "./",
  // Its own dependency cache, so it can run beside the lab's dev server without invalidating that one's.
  cacheDir: "../../node_modules/.vite-example-markets",
  plugins: [react()],
  resolve: { conditions: ["source", ...defaultClientConditions] },
  server: { port: 5320, strictPort: true },
  preview: { port: 5320, strictPort: true },
});
