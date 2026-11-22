/**
 * A divider drag resolves the committed layout once, not on every frame (core-codex CORE-16): each frame's
 * `resizeDivider` takes the resolve made at pointer down, so a frame resolves only its preview. Counted by the kind
 * lookups resolving makes, on a flat row of 64 panes.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, layout as L, memoryStorage, pane, row } from "@jali/core";
import { storeOf } from "@jali/core/adapter";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 20 } };

describe("a divider drag's frames", () => {
  it("reuse the committed layout's resolve", () => {
    const jali = createJali({
      panes: [item],
      layout: row(
        ...Array.from({ length: 64 }, (_, i) => pane({ kind: "item", params: { id: i } })),
      ),
      url: false,
      storage: memoryStorage(),
      size: { width: 4000, height: 800 },
      moveFocus: false,
      settings: { paneCap: 64 },
    });
    const store = storeOf(jali);
    const ctx = store.ctx();
    let lookups = 0;
    const kinds = new Proxy(ctx.fit.kinds, {
      get: (t, k, r) => (lookups++, Reflect.get(t, k, r)),
    });
    const counted = { ...ctx, fit: { ...ctx.fit, kinds } };
    const layout = storeOf(jali).get().layout;
    const d = jali.model().resolved.dividers[10]!;
    const committed = L.resolve(layout, L.tree.noFocus(), counted);
    lookups = 0;
    L.resizeDivider(layout, d.parentId, d.index, 5, counted);
    const fresh = lookups;
    lookups = 0;
    const moved = L.resizeDivider(layout, d.parentId, d.index, 5, counted, committed);
    expect(lookups).toBe(0);
    expect(fresh).toBeGreaterThan(0);
    expect(moved).toEqual(L.resizeDivider(layout, d.parentId, d.index, 5, ctx));
  });
});
