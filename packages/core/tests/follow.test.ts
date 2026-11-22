/**
 * Linked selection (actions/follow.ts): a list's following detail shows its selection once it rests, in place
 * (a swap: no rect changes), with the URL replaced; a kept detail stays; Space shows the row in the detail.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { ObjectRef, PaneNode } from "../src/layout/types";
import { FOLLOW_MS } from "../src/actions/follow";
import { geometryOf, type HistoryMode } from "../src/state/apply";
import { createTestStore } from "./fixtures/workspace";
import type { JaliStore } from "../src/state/store";

let store: JaliStore;
let breaches: string[];
let urls: HistoryMode[];
const order = (id: number): ObjectRef => ({ kind: "record", params: { table: "orders", id } });
const node = (id: string) => store.model().pane(id) as PaneNode;
const said = () => store.get().announcement.text;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  breaches = [];
  urls = [];
  store = createTestStore({
    unstable: (op) => breaches.push(op),
    url: { write: (_s, mode) => urls.push(mode) },
    initial: { area: { width: 1600, height: 800 } },
  });
  store.actions.preset("order-chain");
  store.actions.focus("orders");
  urls = [];
});
afterEach(() => vi.useRealTimers());

describe("a list's detail follows its selection", () => {
  it("after the selection rests, in place, with history replaced", () => {
    const before = geometryOf(store.model());
    store.actions.select("orders", order(2));
    store.actions.select("orders", order(3));
    expect(node("order").ref).toEqual(order(1));
    vi.advanceTimersByTime(FOLLOW_MS - 1);
    expect(node("order").ref).toEqual(order(1));
    store.actions.select("orders", order(4));
    vi.advanceTimersByTime(FOLLOW_MS);
    expect(node("order").ref).toEqual(order(4));
    expect(geometryOf(store.model())).toBe(before);
    expect(breaches).toEqual([]);
    expect(urls).not.toContain("push");
    expect(urls).toContain("replace");
    expect(store.get().view.focused).toBe("orders");
    expect(said()).toBe("Showing order 4");
  });

  it("a kept detail does not follow; releasing catches up with the selection", () => {
    store.actions.setKept("order", true);
    expect(node("order")).toMatchObject({ kept: true });
    store.actions.select("orders", order(5));
    vi.advanceTimersByTime(FOLLOW_MS);
    expect(node("order").ref).toEqual(order(1));
    store.actions.setKept("order", false);
    expect(node("order").ref).toEqual(order(5));
    expect(node("order").follows).toBe(true);
  });

  it("opening the row the detail shows keeps it in place; browsing on, the next open makes a new follower", () => {
    store.actions.select("orders", order(6));
    vi.advanceTimersByTime(FOLLOW_MS);
    const panes = store.model().panes.length;
    store.actions.openBeside("orders", order(6));
    expect(store.model().panes).toHaveLength(panes);
    expect(node("order")).toMatchObject({ ref: order(6), kept: true });
    store.actions.select("orders", order(7));
    vi.advanceTimersByTime(FOLLOW_MS);
    expect(node("order").ref).toEqual(order(6));
    const next = store.actions.openBeside("orders", order(7)).pane!;
    expect(node(next)).toMatchObject({ linkedTo: "orders", follows: true, ref: order(7) });
    store.actions.select("orders", order(8));
    vi.advanceTimersByTime(FOLLOW_MS);
    expect(node(next).ref).toEqual(order(8));
    expect(node("order").ref).toEqual(order(6));
  });

  it("opening a row the detail doesn't show yet (inside the follow delay) shows it there now: never a second copy", () => {
    store.actions.select("orders", order(6));
    vi.advanceTimersByTime(FOLLOW_MS);
    const panes = store.model().panes.length;
    store.actions.select("orders", order(9));
    store.actions.openBeside("orders", order(9));
    expect(store.model().panes).toHaveLength(panes);
    expect(node("order").ref).toEqual(order(9));
    vi.advanceTimersByTime(FOLLOW_MS);
    expect(node("order").ref).toEqual(order(9));
  });

  it("opening the row a kept detail shows, with no follower, goes to the kept one: never a second copy", () => {
    store.actions.select("orders", order(6));
    vi.advanceTimersByTime(FOLLOW_MS);
    store.actions.openBeside("orders", order(6));
    expect(node("order")).toMatchObject({ ref: order(6), kept: true });
    const panes = store.model().panes.length;
    const got = store.actions.openBeside("orders", order(6));
    expect(store.model().panes).toHaveLength(panes);
    expect(got.pane).toBe("order");
    expect(store.get().view.focused).toBe("orders");
  });

  it("a link that is not the selected row (a customer cell) opens a plain pane and never replaces the detail", () => {
    store.actions.select("orders", order(2));
    vi.advanceTimersByTime(FOLLOW_MS);
    const opened = store.actions.openBeside("orders", {
      kind: "record",
      params: { table: "customers", id: 3 },
    }).pane!;
    expect(node(opened).follows).toBeUndefined();
    expect(node(opened).kept).toBeUndefined();
    expect(node("order").ref).toEqual(order(2));
  });

  it("Space with the detail on screen shows the row there, not in a peek sheet; no detail: the sheet", () => {
    const before = geometryOf(store.model());
    store.actions.peek("orders", order(8));
    expect(store.get().view.peek).toBeUndefined();
    expect(node("order").ref).toEqual(order(8));
    expect(geometryOf(store.model())).toBe(before);
    store.actions.close("order");
    store.actions.peek("orders", order(9));
    expect(store.get().view.peek).toEqual(order(9));
  });

  it("a row filtered out of the list stays in the detail, marked not in results", () => {
    store.actions.select("orders", order(2));
    vi.advanceTimersByTime(FOLLOW_MS);
    store.actions.select("orders", order(2), { inResults: false });
    vi.advanceTimersByTime(FOLLOW_MS);
    expect(node("order").ref).toEqual(order(2));
    expect(store.get().selection.orders).toEqual({ ref: order(2), inResults: false });
  });

  it("closing the list unlinks the detail; undo restores the link", () => {
    store.actions.close("orders");
    expect(node("order").linkedTo).toBeUndefined();
    expect(node("order").follows).toBeUndefined();
    store.actions.undo();
    expect(node("order")).toMatchObject({ linkedTo: "orders", follows: true });
  });
});
