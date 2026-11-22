/** The router adapter the URL guide shows, against a router that can block a write. Not shown on the site. */
import { describe, expect, it, vi } from "vitest";
import { routerLocation } from "./router-location";

/** A router's address: navigations it may block, and listeners it calls on every change. */
function fakeRouter() {
  const entries = [""];
  let at = 0;
  let block = false;
  const fns = new Set<() => void>();
  const notify = () => fns.forEach((f) => f());
  return {
    hooks: {
      search: () => entries[at]!,
      navigate(search: string, replace: boolean) {
        if (block) return; // a guard said no
        if (replace) entries[at] = search;
        else entries.splice(++at, entries.length, search);
        notify();
      },
      listen(fn: () => void) {
        fns.add(fn);
        return () => fns.delete(fn);
      },
    },
    blockNext: (on: boolean) => (block = on),
    visit(search: string) {
      entries.splice(++at, entries.length, search);
      notify();
    },
    back() {
      at--;
      notify();
    },
  };
}

describe("routerLocation", () => {
  it("skips Jali's own write and reports a router link", () => {
    const router = fakeRouter();
    const location = routerLocation(router.hooks);
    const heard = vi.fn();
    location.subscribe(heard);
    location.navigate("?l=a", "push");
    expect(heard).not.toHaveBeenCalled();
    router.visit("?l=b");
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("hears a later visit to an address whose write was blocked", () => {
    const router = fakeRouter();
    const location = routerLocation(router.hooks);
    const heard = vi.fn();
    location.subscribe(heard);
    router.blockNext(true);
    location.navigate("?l=a", "push"); // blocked: the address never changes
    router.blockNext(false);
    router.visit("?l=b"); // another navigation
    router.visit("?l=a"); // then a visit to the blocked address, from outside
    expect(heard).toHaveBeenCalledTimes(2);
    expect(location.search()).toBe("?l=a");
  });

  it("reports Back and Forward", () => {
    const router = fakeRouter();
    const location = routerLocation(router.hooks);
    const heard = vi.fn();
    location.subscribe(heard);
    location.navigate("?l=a", "push");
    location.navigate("?l=b", "push");
    router.back();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(location.search()).toBe("?l=a");
  });
});
