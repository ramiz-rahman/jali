/**
 * An action never makes a layout its own link can't reopen (core-codex CORE-9). A link holds at most 256 nodes
 * (and 128 levels); adding a tab to a stack of 255 made 257, the action succeeded, and the address it wrote was a link
 * `decode` refuses. Such a change is refused as "blocked".
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, layout as L, memoryLocation, memoryStorage, pane, tabs } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
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
    expect(L.decode(code, jali.env.kinds.registry())).not.toBeNull();
  });
});
