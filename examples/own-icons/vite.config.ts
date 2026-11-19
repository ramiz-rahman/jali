import { defineConfig, defaultClientConditions } from "vite-plus";
import react from "@vitejs/plugin-react";

// Resolves @jali/* to the packages' source ("source" condition), as the lab does.
export default defineConfig({
  root: __dirname,
  // Its own dependency cache, so it can run beside the lab's dev server without invalidating that one's.
  cacheDir: "../../node_modules/.vite-example-own-icons",
  plugins: [react()],
  resolve: { conditions: ["source", ...defaultClientConditions] },
  server: { port: 5311 },
});
