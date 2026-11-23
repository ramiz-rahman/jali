/**
 * Every example lays out its shared UI the same way (docs/EXAMPLES-STANDARD.md): `src/ui/atoms`, `ui/molecules` and
 * `ui/organisms`, after Brad Frost's atomic design, beside plain helpers (format.ts) and hooks (ui/hooks). Imports go
 * one way, down: an atom uses nothing of the app, a molecule only atoms, an organism only what is below it. Nothing
 * in `ui/` reaches into the app's domain, panes, shell or workspace, but for a molecule's or an organism's types.
 * Pane kinds, the shell and the workspace put these together; a part only one pane uses lives with that pane.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const EXAMPLES = resolve(__dirname, "../..");
const LEVELS = ["atoms", "molecules", "organisms"] as const;
type Level = (typeof LEVELS)[number];

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });

/** The app's relative imports in a file: where each goes (from src/), and whether it imports only types. */
function imports(file: string, src: string) {
  const text = readFileSync(file, "utf8");
  return [
    ...text.matchAll(/^(?:import|export)\s+(type\s+)?[^"';]*?from\s+["'](\.[^"']+)["']/gm),
  ].map((m) => ({
    to: relative(src, resolve(dirname(file), m[2] ?? "")),
    typeOnly: !!m[1],
  }));
}

/** Where a path under src/ sits: a level of ui/, ui/ itself, or the rest of the app. */
function place(path: string): Level | "ui" | "app" {
  const [top, level] = path.split("/");
  if (top !== "ui") return "app";
  return LEVELS.find((l) => l === level) ?? "ui";
}

/** What each level may import, by place: the levels below it and ui/'s helpers; types from the app, above atoms. */
const MAY: Record<Level, { places: string[]; appTypes: boolean }> = {
  atoms: { places: ["atoms", "ui"], appTypes: false },
  molecules: { places: ["atoms", "molecules", "ui"], appTypes: true },
  organisms: { places: ["atoms", "molecules", "organisms", "ui"], appTypes: true },
};

const examples = readdirSync(EXAMPLES).filter((name) => {
  try {
    return statSync(join(EXAMPLES, name, "src/ui")).isDirectory();
  } catch {
    return false;
  }
});

describe.each(examples)("%s's shared UI is atomic", (example) => {
  const src = join(EXAMPLES, example, "src");
  const ui = files(join(src, "ui")).filter((f) => !/\.test\.tsx?$/.test(f));

  it("keeps each component at a level: atoms, molecules or organisms", () => {
    const loose = ui
      .map((f) => relative(src, f))
      .filter((f) => f.endsWith(".tsx") && place(f) === "ui");
    expect(loose).toEqual([]);
  });

  it("imports only downward, and nothing of the app but types", () => {
    const wrong = ui.flatMap((file) => {
      const from = relative(src, file);
      const level = place(from);
      if (level === "ui" || level === "app") return [];
      const may = MAY[level];
      return imports(file, src)
        .filter(({ to, typeOnly }) => {
          const where = place(to);
          if (where === "app") return !(may.appTypes && typeOnly);
          return !may.places.includes(where);
        })
        .map(({ to }) => `${from} → ${to}`);
    });
    expect(wrong).toEqual([]);
  });
});
