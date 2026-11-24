import { defineConfig, defaultClientConditions } from "vite-plus";
import react from "@vitejs/plugin-react";

// Resolves jali-layout to the packages' source ("source" condition), as the other examples do. CyberSpec's files import
// each other through "#src/*", which package.json's "imports" maps to ./src, so no alias is needed here.
export default defineConfig({
  root: __dirname,
  // "./": every asset is linked relative to the page, so the built site works from any path.
  base: "./",
  // Its own dependency cache, so it can run beside the other examples' dev servers without invalidating theirs.
  cacheDir: "../../node_modules/.vite-example-handshake",
  plugins: [react()],
  resolve: { conditions: ["source", ...defaultClientConditions] },
  build: { chunkSizeWarningLimit: 900 },
  // Not strict: when another checkout already holds 5360, `vp dev` takes the next free port and prints it.
  server: { port: 5360 },
  preview: { port: 5360 },
});
