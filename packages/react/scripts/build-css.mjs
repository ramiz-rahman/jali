// Writes dist/styles.css (src/styles/index.css with its @imports inlined), dist/theme.css and dist/tailwind.css.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src/styles");
const out = join(root, "dist");
mkdirSync(out, { recursive: true });

const inline = (file) =>
  readFileSync(join(src, file), "utf8").replace(/^@import "\.\/([\w.-]+\.css)";\s*$/gm, (_, f) => inline(f).trim());

writeFileSync(join(out, "styles.css"), inline("index.css"));
writeFileSync(join(out, "theme.css"), readFileSync(join(src, "jali-theme.css"), "utf8"));
writeFileSync(join(out, "tailwind.css"), readFileSync(join(src, "jali-tailwind.css"), "utf8"));
console.log("css: styles.css, theme.css, tailwind.css");
