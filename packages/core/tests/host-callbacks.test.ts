/**
 * Host callbacks and ref equality are handled one way (core-opus CORE-19). A kind's `identity` that throws is guarded
 * as `title` and `follow` are; a layout whose params come back in another key order keeps the person's sizes.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryStorage, row, type Layout } from "@jali/core";
import { structureKey } from "@jali/core/adapter";

describe("host callbacks and ref equality", () => {
  it("a kind's identity that throws doesn't break open", () => {
    const thing = {
      kind: "thing",
      title: "Thing",
      params: { id: Number },
      width: { min: 200 },
      identity: (): unknown => {
        throw new Error("boom");
      },
    };
    const jali = createJali({
      panes: [thing],
      layout: row({ kind: "thing", params: { id: 1 } }),
      url: false,
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
    });
    const first = jali.model().resolved.panes[0]!.id;
    expect(jali.actions.openBeside(first, { kind: "thing", params: { id: 2 } }).ok).toBe(true);
    expect(
      jali.env.kinds.sameObject(
        { kind: "thing", params: { id: 1 } },
        { kind: "thing", params: { id: 1 } },
      ),
    ).toBe(true);
  });

  it("a layout's structure doesn't depend on its params' key order", () => {
    const at = (params: Record<string, string | number>): Layout => ({
      version: 1,
      root: { type: "pane", id: "p", size: { weight: 1 }, ref: { kind: "k", params } },
    });
    expect(structureKey(at({ a: 1, b: "x" }))).toBe(structureKey(at({ b: "x", a: 1 })));
  });
});
