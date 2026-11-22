/**
 * Kinds and options are checked as they are given (core-opus CORE-12). A size that can't be used is left out (the
 * default stands) and development says so; before, `width: { min: NaN }` put panes at NaN px. Two kinds with one name,
 * two presets with one id and an unknown `preset` are development errors too.
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryStorage, row, type JaliOptions } from "@jali/core";
import { createPaneKinds } from "@jali/core/adapter";

const ref = (kind: string) => ({ kind, params: {} });
const make = (o: Partial<JaliOptions>) =>
  createJali({
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    panes: [],
    ...o,
  });

let errors: ReturnType<typeof vi.spyOn>;
afterEach(() => errors?.mockRestore());
const said = () => errors.mock.calls.map((c: unknown[]) => String(c[0])).join("\n");

describe("pane kinds' sizes", () => {
  it.each([[NaN], [-10], [Infinity], ["300" as unknown as number]])(
    "a min of %j is left out",
    (min) => {
      errors = vi.spyOn(console, "error").mockImplementation(() => {});
      const jali = make({
        panes: [
          { kind: "a", title: "A", width: { min } },
          { kind: "b", title: "B" },
        ],
        layout: row(ref("a"), ref("b")),
      });
      for (const p of jali.model().resolved.panes)
        expect([p.rect.x, p.rect.y, p.rect.width, p.rect.height].every(Number.isFinite)).toBe(true);
      expect(said()).toMatch(/kind "a": width.min/);
    },
  );

  it("a max below the min is left out", () => {
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const k = createPaneKinds([{ kind: "a", title: "A", width: { min: 500, max: 100 } }]).registry()
      .a!;
    expect(k.minWidth).toBe(500);
    expect(k.maxWidth).toBeUndefined();
    expect(said()).toMatch(/below its min/);
  });

  it("good sizes say nothing", () => {
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
    createPaneKinds([
      {
        kind: "a",
        title: "A",
        width: { min: 200, comfortable: 300, max: 600 },
        height: { min: 0 },
      },
    ]).registry();
    expect(errors).not.toHaveBeenCalled();
  });
});

describe("names given twice", () => {
  it("two kinds with one name", () => {
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
    createPaneKinds([
      { kind: "a", title: "One" },
      { kind: "a", title: "Two" },
    ]);
    expect(said()).toMatch(/kind "a" is defined twice/);
  });

  it("two presets with one id, and a preset that isn't there", () => {
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
    make({
      panes: [{ kind: "a", title: "A" }],
      presets: [
        { id: "p", label: "P", layout: ref("a") },
        { id: "p", label: "P again", layout: ref("a") },
      ],
      preset: "typo",
    });
    expect(said()).toMatch(/two presets have the id "p"/);
    expect(said()).toMatch(/no preset "typo"/);
  });
});
