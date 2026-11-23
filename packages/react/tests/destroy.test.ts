/**
 * `jali.destroy()` (QUALITY-REVIEW P18): a workspace that goes away leaves nothing running. Deferred follow steps and
 * the address's debounced write don't land on the next route, the kind registry lets it go, and pane state waiting to
 * be saved is saved, by `destroy()` and by the stop `start()` returns.
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row, type JaliOptions } from "@jali/core";
import { loadPaneState, storeOf } from "@jali/core/adapter";
import { FOLLOW_MS } from "../../core/src/actions/follow";
import { definePane } from "@jali/react";
import { defaultFeatures, noUrl, urlSync } from "./features";

const orders = definePane("orders", {
  title: "Orders",
  selects: "order",
  Component: () => null,
});
const order = definePane("order", {
  params: { id: Number },
  title: ({ id }) => `Order ${id}`,
  Component: () => null,
});

const make = (options: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [orders, order],
    layout: row(
      pane(orders(), { id: "list" }),
      pane(order({ id: 1 }), { id: "detail", linkedTo: "list", follows: true }),
    ),
    storage: memoryStorage(),
    size: { width: 1400, height: 800 },
    moveFocus: false,
    ...options,
  });

afterEach(() => vi.useRealTimers());

describe("jali.destroy()", () => {
  it("drops a follow still waiting for the selection to rest", () => {
    vi.useFakeTimers();
    const jali = make({ features: noUrl() });
    jali.actions.select("list", order({ id: 2 }));
    jali.destroy();
    vi.advanceTimersByTime(FOLLOW_MS * 4);
    expect(jali.model().pane("detail")?.ref).toEqual(order({ id: 1 }));
  });

  it("drops a debounced address write, so it never lands on the next route", () => {
    vi.useFakeTimers();
    const location = memoryLocation();
    const jali = make({ features: [...defaultFeatures(), urlSync({ location })] });
    const store = storeOf(jali);
    const before = location.search();
    store.writeUrl("debounce");
    location.navigate("?route=next", "push");
    jali.destroy();
    vi.advanceTimersByTime(5_000);
    expect(location.search()).toBe("?route=next");
    expect(before).not.toBe("?route=next");
  });

  it("stops listening to the kind registry", () => {
    const jali = make({ features: noUrl() });
    const heard = vi.fn();
    jali.subscribe(heard);
    jali.destroy();
    jali.env.kinds.register({ kind: "late", title: "Late" });
    expect(heard).not.toHaveBeenCalled();
  });

  it("saves pane state waiting to be saved, and so does the stop start() returns", () => {
    vi.useFakeTimers();
    for (const end of ["destroy", "stop"] as const) {
      const storage = memoryStorage();
      const jali = make({ features: noUrl(), storage });
      const stop = jali.start();
      storeOf(jali).actions.setPaneState("detail", "scroll", 240);
      if (end === "destroy") jali.destroy();
      else stop();
      expect(loadPaneState(storage)).toEqual({ detail: { scroll: 240 } });
      jali.destroy();
    }
  });

  it("saves pane state waiting to be saved when the page goes away or is hidden", () => {
    vi.useFakeTimers();
    try {
      for (const leave of ["pagehide", "hidden"] as const) {
        const storage = memoryStorage();
        const jali = make({ features: noUrl(), storage });
        const stop = jali.start();
        storeOf(jali).actions.setPaneState("detail", "draft", "Dear");
        // Typed just now: the 400 ms save hasn't run.
        expect(storage.get("pane-state@2")).toBeNull();
        if (leave === "pagehide") window.dispatchEvent(new Event("pagehide"));
        else {
          // Shown again first: nothing to save yet is no reason to save.
          document.dispatchEvent(new Event("visibilitychange"));
          expect(storage.get("pane-state@2")).toBeNull();
          Object.defineProperty(document, "visibilityState", {
            value: "hidden",
            configurable: true,
          });
          document.dispatchEvent(new Event("visibilitychange"));
        }
        expect(loadPaneState(storage)).toEqual({ detail: { draft: "Dear" } });
        stop();
        jali.destroy();
      }
    } finally {
      // jsdom's own "visible" again.
      Reflect.deleteProperty(document, "visibilityState");
    }
  });

  it("can be called twice, and a start after it does nothing", () => {
    const jali = make({ features: noUrl() });
    jali.destroy();
    expect(() => jali.destroy()).not.toThrow();
    const stop = jali.start();
    expect(typeof stop).toBe("function");
    stop();
  });

  it("ends a discard question still open: the action it held settles as unavailable", async () => {
    const jali = make();
    storeOf(jali).actions.setUnsaved("detail", "a reply");
    const r = jali.actions.close("detail");
    expect(r.reason).toBe("unsaved");
    expect(storeOf(jali).get().confirm).not.toBeNull();
    jali.destroy();
    expect(storeOf(jali).get().confirm).toBeNull();
    await expect(r.settled).resolves.toEqual({ ok: false, reason: "unavailable" });
    expect(jali.model().pane("detail")).toBeDefined();
  });
});
