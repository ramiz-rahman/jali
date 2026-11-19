// @vitest-environment node
/**
 * Jali ships its own default icons, so no app bundles an icon library for them. Builds examples/minimal (Jali's icons)
 * and examples/own-icons (the host's for every name) and checks neither has Phosphor in it, and that the minimal one
 * has Jali's icons. Both build from the packages' source, and again from dist when `pnpm build:packages` has made it
 * (what a `link:` host gets).
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { build, defaultClientConditions } from "vite-plus";
import react from "@vitejs/plugin-react";

const repo = fileURLToPath(new URL("../../..", import.meta.url));
const hasDist = existsSync(`${repo}/packages/react/dist/icons.js`);

/** All the JavaScript a production build of the example emits. */
async function bundle(example: string, from: "source" | "dist"): Promise<string> {
  const out = await build({
    configFile: false,
    root: `${repo}/examples/${example}`,
    logLevel: "silent",
    plugins: [react()],
    resolve: {
      conditions:
        from === "source" ? ["source", ...defaultClientConditions] : [...defaultClientConditions],
    },
    build: { write: false, minify: true },
  });
  const outputs = (Array.isArray(out) ? out : [out]) as {
    output: { type: string; code?: string }[];
  }[];
  return outputs
    .flatMap((o) => o.output)
    .filter((c) => c.type === "chunk")
    .map((c) => c.code)
    .join("\n");
}

/** Phosphor's marks: its package name, and its weights, which every Phosphor icon carries as strings. */
const phosphorIn = (code: string) => ({
  name: code.includes("@phosphor-icons"),
  weights: code.includes("duotone"),
});

describe.each(hasDist ? (["source", "dist"] as const) : (["source"] as const))(
  "bundles from %s",
  (from) => {
    it("an app on Jali's own icons has no Phosphor in it, and has Jali's icons", async () => {
      const code = await bundle("minimal", from);
      expect(phosphorIn(code)).toEqual({ name: false, weights: false });
      expect(code).toContain("data-jali-icon");
    }, 60_000);

    it("an app with its own icon for every name has no Phosphor in it", async () => {
      const code = await bundle("own-icons", from);
      expect(code).toContain("Open the next note beside");
      expect(phosphorIn(code)).toEqual({ name: false, weights: false });
    }, 60_000);
  },
);
