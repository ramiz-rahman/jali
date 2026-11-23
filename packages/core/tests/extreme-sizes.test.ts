/**
 * Every layout validation accepts gives finite rects (core-codex CORE-4). Weights of 1e308 overflowed the weight sum
 * and the weighted product, and a px size as large multiplied before dividing: the panes came out NaN wide.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, type Layout } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { urlSync } from "../src/features/url-sync";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 200 } };
const pane = (id: string, size: Layout["root"]["size"]) =>
  ({ type: "pane", id, size, ref: { kind: "item", params: { id: 1 } } }) as const;
const rowOf = (...children: Layout["root"][]): Layout =>
  ({ version: 1, root: { type: "row", id: "r", size: { weight: 1 }, children } }) as Layout;

const finite = (layout: Layout) => {
  const jali = createJali({
    panes: [item],
    layout,
    features: [urlSync({ location: memoryLocation(), sizes: "link" })],
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });
  // Reopened from its own link too.
  const again = createJali({
    panes: [item],
    layout: rowOf(pane("z", { weight: 1 })),
    features: [
      urlSync({
        location: memoryLocation(storeOf(jali).href().slice("memory:".length)),
        sizes: "link",
      }),
    ],
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });
  for (const j of [jali, again])
    for (const p of storeOf(j).model().resolved.panes)
      expect([p.rect.x, p.rect.y, p.rect.width, p.rect.height].every(Number.isFinite)).toBe(true);
};

describe("extreme sizes", () => {
  it.each([
    ["two huge weights", rowOf(pane("a", { weight: 1e308 }), pane("b", { weight: 1e308 }))],
    [
      "a huge and a tiny weight",
      rowOf(pane("a", { weight: 1e308 }), pane("b", { weight: 5e-324 })),
    ],
    ["two huge px", rowOf(pane("a", { px: 1e308 }), pane("b", { px: 1e308 }))],
    ["a huge px beside a weight", rowOf(pane("a", { px: 1e308 }), pane("b", { weight: 1 }))],
  ])("%s give finite rects", (_, layout) => finite(layout));
});
