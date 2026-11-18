import { defineConfig, defaultClientConditions } from "vite";
import react from "@vitejs/plugin-react";

// Resolves @jali/* to the packages' source ("source" condition), as the lab does.
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: { conditions: ["source", ...defaultClientConditions] },
});
