import { defineConfig, defaultClientConditions } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  // The packages resolve to their source (the "source" export condition), so the lab runs them without a build.
  resolve: { conditions: ["source", ...defaultClientConditions] },
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  test: { globals: true, include: ["src/**/*.test.{ts,tsx}", "packages/*/src/**/*.test.{ts,tsx}"], environment: "jsdom", exclude: ["e2e/**", "node_modules/**"] },
} as any);
