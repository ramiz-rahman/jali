/** Every file `package.json` lists ships (core-opus CORE-21): `files` listed a LICENSE the package doesn't have. */
import { describe, expect, it } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { files: string[] };

describe("@jali/core's package files", () => {
  it("lists only files it has (dist is built at pack time)", () => {
    expect(pkg.files.filter((f) => f !== "dist" && !existsSync(join(root, f)))).toEqual([]);
  });
});
