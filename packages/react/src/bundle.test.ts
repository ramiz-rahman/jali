// @vitest-environment node
/**
 * A host that brings every icon never bundles Phosphor. Builds examples/bare-icons (on `@jali/react/bare`) and checks
 * the output has no Phosphor in it; builds examples/minimal (on `@jali/react`) as the control, which must. Both build
 * from the packages' source, and again from dist when `pnpm build:packages` has made it (what a `link:` host gets).
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { build, defaultClientConditions } from "vite-plus";
import react from "@vitejs/plugin-react";

const repo = fileURLToPath(new URL("../../..", import.meta.url));
const hasDist = existsSync(`${repo}/packages/react/dist/bare.js`);

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
    it("@jali/react/bare with a full icon set has no Phosphor in it", async () => {
      const code = await bundle("bare-icons", from);
      expect(code).toContain("Open the next note beside");
      expect(phosphorIn(code)).toEqual({ name: false, weights: false });
    }, 60_000);

    it("@jali/react with no icons has Phosphor's (the control)", async () => {
      expect(phosphorIn(await bundle("minimal", from)).weights).toBe(true);
    }, 60_000);
  },
);
