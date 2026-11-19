import { existsSync, readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";

// Builds one size scenario (SIZE_SCENARIO) as an app would: production mode, against the packed dist (no "source"
// condition), with each package in a chunk of its own so its share can be measured. Run by scripts/size.mjs.
const scenario = process.env.SIZE_SCENARIO ?? "minimal";
const entry = process.env.SIZE_ENTRY ?? `${scenario}.tsx`;

/** Hands the bundler the dist's own source maps, so the app's map points into packages/*\/src and
 *  scripts/size.mjs can say which source files the shipped bytes come from. */
function distMaps(): Plugin {
  return {
    name: "size-dist-maps",
    load(id) {
      if (
        !/[\\/]packages[\\/](core|react)[\\/]dist[\\/].*\.js$/.test(id) ||
        !existsSync(`${id}.map`)
      )
        return;
      return { code: readFileSync(id, "utf8"), map: readFileSync(`${id}.map`, "utf8") };
    },
  };
}

export default defineConfig({
  root: import.meta.dirname,
  mode: "production",
  logLevel: "warn",
  cacheDir: "../../node_modules/.vite-size",
  plugins: [react(), distMaps()],
  build: {
    outDir: `../../node_modules/.size/${scenario}`,
    emptyOutDir: true,
    reportCompressedSize: false,
    sourcemap: "hidden",
    rolldownOptions: {
      input: { [scenario]: `${import.meta.dirname}/${entry}` },
      output: {
        codeSplitting: {
          // Higher priority first, so a package's own dependencies (Phosphor, React) aren't counted in its chunk.
          groups: [
            {
              name: "react",
              priority: 3,
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
            { name: "phosphor", priority: 3, test: /node_modules[\\/]@phosphor-icons[\\/]/ },
            { name: "jali-core", priority: 2, test: /packages[\\/]core[\\/]dist/ },
            { name: "jali-react", priority: 1, test: /packages[\\/]react[\\/]dist/ },
          ],
        },
      },
    },
  },
});
