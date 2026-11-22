// Writes dist/styles.css, dist/theme.css and dist/tailwind.css from packages/react's styles (its own build script).
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
execFileSync(process.execPath, [join(root, "../react/scripts/build-css.mjs"), join(root, "dist")], {
  stdio: "inherit",
});
