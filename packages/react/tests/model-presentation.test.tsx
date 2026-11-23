/**
 * `jali.model()` says what React draws (Codex's review of step 7a): one pane at a time, stacked view follows the
 * on-screen keyboard and the divider the person moved, a curated page never stacks, a pane on the whole screen covers
 * the rest, and a maximised pane in a row that scrolls is shown whatever the row's scroll.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { JaliRoot, definePane } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

// jsdom measures nothing: Jali's root is a portrait phone's.
const size = { clientWidth: 390, clientHeight: 772 };
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  for (const [k, v] of Object.entries(size))
    Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get: () => v });
});
afterAll(() => {
  for (const k of Object.keys(size))
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
});
afterEach(() => {
  cleanup();
  delete (window as { visualViewport?: unknown }).visualViewport;
});

const list = definePane("list", {
  title: () => "Orders",
  width: { min: 280 },
  Component: () => null,
});
const order = definePane("order", {
  params: { id: Number },
  title: ({ id }) => `Order ${id}`,
  width: { min: 300 },
  Component: () => null,
});

const stacked = () => {
  const jali = createJali({
    panes: [list, order],
    layout: list(),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 378, height: 760 },
    moveFocus: false,
    phone: { stack: true },
  });
  const orders = jali.model().panes[0]!.id;
  const detail = jali.actions.openBeside(orders, order({ id: 7 })).pane!;
  return { jali, orders, detail };
};

/** Where React drew a pane: its frame's box, or null when it isn't drawn. */
const drawn = (container: HTMLElement, id: string) => {
  const el = container.querySelector<HTMLElement>(`[data-pane="${id}"]`)!;
  return el.style.display === "none"
    ? null
    : { top: parseFloat(el.style.top), height: parseFloat(el.style.height) };
};
const where = (jali: ReturnType<typeof stacked>["jali"]) =>
  Object.fromEntries(jali.model().panes.map((p) => [p.id, p.where]));

describe("stacked view, as drawn", () => {
  it("both panes are shown, with the boxes their frames have", () => {
    const { jali, orders, detail } = stacked();
    const { container } = render(<JaliRoot jali={jali} />);
    expect(where(jali)).toEqual({ [orders]: "shown", [detail]: "shown" });
    for (const id of [orders, detail]) {
      const box = jali.model().pane(id)!.box!;
      expect(drawn(container, id)).toEqual({ top: expect.any(Number), height: box.height });
    }
  });

  it("with the on-screen keyboard up, only the focused pane shows, in the model too", () => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: { height: 300, addEventListener() {}, removeEventListener() {} },
    });
    const { jali, orders, detail } = stacked();
    const { container } = render(<JaliRoot jali={jali} />);
    // The focused pane is the list (opening a detail leaves focus where it was).
    expect(drawn(container, detail)).toBeNull();
    expect(jali.model().pane(detail)?.where).not.toBe("shown");
    expect(jali.model().pane(orders)?.box?.height).toBe(drawn(container, orders)?.height);
  });

  it("follows the divider the person moved", () => {
    const { jali, orders } = stacked();
    const { container } = render(<JaliRoot jali={jali} />);
    const before = jali.model().pane(orders)!.box!.height;
    act(
      () => void fireEvent.keyDown(container.querySelector(".jali-stack-divider")!, { key: "End" }),
    );
    const after = jali.model().pane(orders)!.box!.height;
    expect(after).toBeGreaterThan(before);
    expect(drawn(container, orders)?.height).toBe(after);
  });

  it("a pane on the whole screen covers the other", () => {
    const { jali, orders, detail } = stacked();
    render(<JaliRoot jali={jali} />);
    let r: unknown;
    act(() => void (r = jali.actions.toggleFullScreen(detail)));
    expect(r).toMatchObject({ ok: true });
    expect(jali.model().pane(detail)?.where).toBe("shown");
    expect(jali.model().pane(orders)).toMatchObject({ where: "hidden", box: null });
  });

  it("a curated page's split view doesn't stack: the focused view shows alone", () => {
    const { jali, orders, detail } = stacked();
    storeOf(jali).set({ page: { profile: "p", item: 1, mode: "split", tab: "a" } });
    expect(jali.model().pane(orders)?.where).toBe("shown");
    expect(jali.model().pane(detail)?.where).not.toBe("shown");
  });
});

describe("a maximised pane in a row that scrolls", () => {
  it("is shown, filling the room, whatever the row's scroll", () => {
    const note = definePane("note", {
      params: { id: Number },
      title: ({ id }) => `Note ${id}`,
      Component: () => null,
    });
    const jali = createJali({
      panes: [note],
      layout: row(
        { scroll: "x", id: "strip" },
        ...[1, 2, 3, 4, 5, 6].map((i) => pane(note({ id: i }), { id: `p${i}`, px: 400 })),
      ),
      storage: memoryStorage(),
      size: { width: 1000, height: 800 },
      moveFocus: false,
    });
    storeOf(jali).actions.setScroll("strip", 1400);
    jali.actions.focus("p6");
    jali.actions.toggleZoom();
    const m = jali.model();
    expect(m.pane("p6")?.where).toBe("shown");
    expect(m.pane("p6")?.box).toMatchObject({
      width: expect.any(Number),
      height: expect.any(Number),
    });
    expect(m.pane("p6")!.box!.width).toBeGreaterThan(900);
    expect(m.panes.filter((p) => p.where === "shown").map((p) => p.id)).toEqual(["p6"]);
  });
});
