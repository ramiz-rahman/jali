/**
 * An action never makes a layout its own link can't reopen (core-codex CORE-9). A link holds at most 256 nodes
 * (and 128 levels); adding a tab to a stack of 255 made 257, the action succeeded, and the address it wrote was a link
 * `decode` refuses. Such a change is refused as "blocked".
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, tabs } from "@jali/core";
import { storeOf, layout as L } from "@jali/core/adapter";
import { urlSync } from "../src/features/url-sync";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 200 } };

describe("a layout's size", () => {
  it("an action that would pass what a link holds is refused, and the link still reopens", () => {
    const location = memoryLocation();
    const many = Array.from({ length: 255 }, (_, i) =>
      pane({ kind: "item", params: { id: i } }, { id: `p${i}` }),
    );
    const jali = createJali({
      panes: [item],
      layout: tabs(...many),
      features: [urlSync({ location, sizes: "link" })],
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
    });
    expect(jali.actions.addTab("p0", { kind: "item", params: { id: 999 } })).toMatchObject({
      ok: false,
      reason: "blocked",
    });
    const code = new URLSearchParams(storeOf(jali).href().slice("memory:".length)).get("l")!;
    expect(L.decode(code, storeOf(jali).env.kinds.registry())).not.toBeNull();
  });
});

/**
 * The writer checks the text it would publish, as the reader limits it (core review 22 Nov 2026, #7). Before, one
 * long param in a small layout passed the node count: openHere succeeded and wrote 1,013,594 characters of layout,
 * which `decode` refuses.
 */
describe("a layout's text", () => {
  const note = { kind: "note", title: "Note", params: { text: String }, width: { min: 200 } };
  const make = (o: { url?: boolean } = {}) => {
    const location = memoryLocation();
    const jali = createJali({
      panes: [item, note],
      layout: tabs(pane({ kind: "item", params: { id: 1 } }, { id: "a" })),
      ...(o.url === false ? {} : { features: [urlSync({ location })] }),
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
    });
    jali.start();
    return { jali, location };
  };
  const huge = { kind: "note", params: { text: "x".repeat(800_000) } };

  it("too long for a link to read back is refused, and the link still reopens", () => {
    const { jali, location } = make();
    expect(jali.actions.openHere("a", huge)).toMatchObject({ ok: false, reason: "blocked" });
    const code = new URLSearchParams(location.search()).get("l")!;
    expect(L.decode(code, storeOf(jali).env.kinds.registry())).not.toBeNull();
  });

  it("that fits is written, and reads back as the same panes", () => {
    const { jali, location } = make();
    const long = { kind: "note", params: { text: "y".repeat(200_000) } };
    expect(jali.actions.openHere("a", long).ok).toBe(true);
    const code = new URLSearchParams(location.search()).get("l")!;
    const back = L.decode(code, storeOf(jali).env.kinds.registry());
    expect(back && L.tree.panes(back.root).map((p) => p.ref)).toEqual([long]);
  });

  it("is not limited where the instance keeps no address", () => {
    const { jali } = make({ url: false });
    expect(jali.actions.openHere("a", huge).ok).toBe(true);
  });
});
