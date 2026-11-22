/** The location and storage ports: a router owns the address, and Jali keeps to its own params. */
import { describe, expect, it, vi } from "vite-plus/test";
import { createTestStore } from "./fixture";
import { memoryLocation, memoryStorage } from "../../../core/src/ports";
import { createUrlSync } from "../../../core/src/url";
import { decode } from "../../../core/src/layout";
import { linkLayout } from "../../../core/src/pane-kinds";

const area = { width: 1600, height: 900 };

describe("the location port", () => {
  it("writes through the port, never the browser, and keeps the host's own params", () => {
    const location = memoryLocation("?team=ops&sort=asc");
    const url = createUrlSync({ location, storage: memoryStorage() });
    const store = createTestStore({ url, storage: memoryStorage(), initial: { area } });
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

  it("reads back what it wrote: the same layout from the same address, as a link carries it", () => {
    const location = memoryLocation();
    const url = createUrlSync({ location, storage: memoryStorage() });
    const a = createTestStore({ url, storage: memoryStorage(), initial: { area } });
    a.actions.preset("query-chart");
    const kinds = a.env.kinds.registry();
    const read = url.read(kinds);
    // The query's `autorun` (app-only) and the chart's `runId` (`link: false`) stay out of the address.
    expect(read && "layout" in read && read.layout.root).toEqual(
      linkLayout(kinds, a.get().layout).root,
    );
  });

  it("two workspaces share one address under their own prefixes", () => {
    const location = memoryLocation("?keep=1");
    const a = createTestStore({
      url: createUrlSync({ location, storage: memoryStorage() }),
      storage: memoryStorage(),
      initial: { area },
    });
    const b = createTestStore({
      url: createUrlSync({ location, storage: memoryStorage(), prefix: "b." }),
      storage: memoryStorage(),
      initial: { area },
    });
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
    const store = createTestStore({ url, storage: memoryStorage(), initial: { area } });
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
    expect(createTestStore({ storage: saved, initial: { area } }).get().settings.paneCap).toBe(2);
  });
});

describe("what a link carries about sizes", () => {
  const userSized = (search: string, kinds: Parameters<typeof decode>[1]) => {
    const layout = decode(new URLSearchParams(search).get("l")!, kinds)!;
    return JSON.stringify(layout.root).includes("userSized");
  };
  const dragged = (sizes: "link" | "local") => {
    vi.useFakeTimers();
    const location = memoryLocation();
    const storage = memoryStorage();
    const url = createUrlSync({ location, storage, sizes });
    const store = createTestStore({ url, storage: memoryStorage(), initial: { area } });
    store.actions.preset("order-chain");
    store.actions.resizeDivider("r", 0, 160);
    vi.advanceTimersByTime(500);
    vi.useRealTimers();
    return { location, storage, store, kinds: store.env.kinds.registry() };
  };

  it("local (the default): the link has the designed sizes, and the person's own reload keeps theirs", () => {
    const { location, storage, store, kinds } = dragged("local");
    expect(userSized(location.search(), kinds)).toBe(false);
    const mine = createUrlSync({
      location: memoryLocation(location.search()),
      storage,
      sizes: "local",
    }).read(kinds);
    expect(mine && "layout" in mine && mine.layout.root).toEqual(store.get().layout.root);
    const theirs = createUrlSync({
      location: memoryLocation(location.search()),
      storage: memoryStorage(),
      sizes: "local",
    }).read(kinds);
    expect(
      theirs && "layout" in theirs && JSON.stringify(theirs.layout.root).includes("userSized"),
    ).toBe(false);
  });

  it("link: the link reopens exactly, sizes included", () => {
    const { location, store, kinds } = dragged("link");
    expect(userSized(location.search(), kinds)).toBe(true);
    const read = createUrlSync({
      location: memoryLocation(location.search()),
      storage: memoryStorage(),
      sizes: "link",
    }).read(kinds);
    expect(read && "layout" in read && read.layout.root).toEqual(store.get().layout.root);
  });
});
