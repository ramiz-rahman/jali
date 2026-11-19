/**
 * `store.focusHeld` (from `@jali/core/adapter`): while something drives the workspace for a person who is watching (the
 * docs' hero tour), Jali moves no DOM focus of its own, so their keyboard focus stays where they left it.
 */
import { describe, expect, it, vi } from "vite-plus/test";
import { memoryStorage } from "../packages/core/src/ports";
import { createTestStore } from "./workspace";

const make = () => {
  const focusPane = vi.fn();
  const store = createTestStore({
    storage: memoryStorage(),
    focusPane,
    initial: { area: { width: 1600, height: 800 } },
  });
  store.actions.preset("order-chain");
  focusPane.mockClear();
  return { store, focusPane };
};

describe("focusHeld", () => {
  it("is off by default: a tuck moves focus into the pane's home", () => {
    const { store, focusPane } = make();
    expect(store.focusHeld).toBe(false);
    store.actions.tuck("customer");
    expect(focusPane).toHaveBeenCalled();
  });

  it("while on, the same change moves no focus; turned off, focus moves again", () => {
    const { store, focusPane } = make();
    store.focusHeld = true;
    store.actions.tuck("customer");
    store.actions.putBack("customer");
    expect(focusPane).not.toHaveBeenCalled();

    store.focusHeld = false;
    store.actions.tuck("customer");
    expect(focusPane).toHaveBeenCalled();
  });
});
