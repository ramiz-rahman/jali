/**
 * The address port takes only what is Jali's (core-codex CORE-15): a replace keeps the history entry's state, and the
 * unprefixed workspace clears `app` and `arr` only when they are an old lab link's (`app=review`). The `keys` option
 * says "scoped", and a misspelling never widens the keys a workspace takes (core-codex CORE-18).
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, row } from "@jali/core";
import { browserLocation, buildSearch, storeOf } from "@jali/core/adapter";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 200 } };

afterEach(() => vi.restoreAllMocks());

describe("the address port", () => {
  it("a replace keeps the history entry's state", () => {
    history.replaceState({ router: 7 }, "", "/x?a=1");
    browserLocation().navigate("?a=1&l=2", "replace");
    expect(history.state).toEqual({ router: 7 });
    expect(location.search).toBe("?a=1&l=2");
  });

  it("leaves the host's own app and arr alone", () => {
    const location = memoryLocation("?app=crm&arr=3");
    const jali = createJali({
      panes: [item],
      layout: row({ kind: "item", params: { id: 1 } }),
      url: { location },
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
    });
    const q = new URLSearchParams(location.search());
    expect([q.get("app"), q.get("arr")]).toEqual(["crm", "3"]);
    // An old lab link's own are still cleared.
    const s = storeOf(jali).get();
    const old = new URLSearchParams(buildSearch("?app=review&arr=x", { ...s, page: null }));
    expect([old.get("app"), old.get("arr")]).toEqual([null, null]);
  });

  it("a misspelt keys option is a development error", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    createJali({
      panes: [item],
      layout: row({ kind: "item", params: { id: 1 } }),
      url: false,
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
      keys: "workspace" as never,
    });
    expect(String(errors.mock.calls[0]?.[0])).toMatch(/keys is "page" or "scoped"/);
  });
});
