/** The location and storage ports: a router owns the address, and Jali keeps to its own params. */
import { describe, expect, it } from "vitest";
import { createLabStore } from "../lab";
import { memoryLocation, memoryStorage } from "./ports";
import { createUrlSync } from "./url";

const area = { width: 1600, height: 900 };

describe("the location port", () => {
  it("writes through the port, never the browser, and keeps the host's own params", () => {
    const location = memoryLocation("?team=ops&sort=asc");
    const url = createUrlSync({ location, storage: memoryStorage() });
    const store = createLabStore({ url, storage: memoryStorage(), initial: { area } });
    const before = window.location.search;
    store.actions.preset("order-chain");
    const q = new URLSearchParams(location.search());
    expect(q.get("team")).toBe("ops");
    expect(q.get("sort")).toBe("asc");
    expect(q.get("l")).toBeTruthy();
    expect(location.entries.length).toBe(2);
    expect(window.location.search).toBe(before);
    expect(store.href()).toBe(location.href());
  });

  it("reads back what it wrote: the same layout from the same address", () => {
    const location = memoryLocation();
    const url = createUrlSync({ location, storage: memoryStorage() });
    const a = createLabStore({ url, storage: memoryStorage(), initial: { area } });
    a.actions.preset("query-chart");
    const read = url.read(a.env.kinds.registry());
    expect(read && "layout" in read && read.layout.root).toEqual(a.get().layout.root);
  });

  it("two workspaces share one address under their own prefixes", () => {
    const location = memoryLocation("?keep=1");
    const a = createLabStore({ url: createUrlSync({ location, storage: memoryStorage() }), storage: memoryStorage(), initial: { area } });
    const b = createLabStore({ url: createUrlSync({ location, storage: memoryStorage(), prefix: "b." }), storage: memoryStorage(), initial: { area } });
    a.actions.preset("order-chain");
    b.actions.preset("query-chart");
    const q = new URLSearchParams(location.search());
    expect(q.get("keep")).toBe("1");
    expect(q.get("l")).toBeTruthy();
    expect(q.get("b.l")).toBeTruthy();
    expect(q.get("l")).not.toBe(q.get("b.l"));
  });

  it("navigation the workspace did not make reaches it, and its own writes do not echo back", () => {
    const location = memoryLocation();
    const url = createUrlSync({ location, storage: memoryStorage() });
    const store = createLabStore({ url, storage: memoryStorage(), initial: { area } });
    let heard = 0;
    const off = url.onPop(() => heard++);
    store.actions.preset("order-chain");
    expect(heard).toBe(0);
    location.visit("?l=" + new URLSearchParams(location.search()).get("l"));
    expect(heard).toBe(1);
    off();
  });
});

describe("the storage port", () => {
  it("settings come from the store's storage, not the browser's", () => {
    // A store starts from what its own storage holds, and never reads the browser's.
    const saved = memoryStorage({ settings: JSON.stringify({ paneCap: 2 }) });
    expect(createLabStore({ storage: saved, initial: { area } }).get().settings.paneCap).toBe(2);
  });
});
