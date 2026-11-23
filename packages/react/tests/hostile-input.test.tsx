/**
 * Hostile input (docs/reviews/QUALITY-REVIEW.md, C1–C7 and P17): every value from outside (a link, storage, an agent, the
 * host's own calls) is checked once, where it comes in, and never crashes the workspace, reaches a CSS selector
 * unescaped or passes for a real kind or id because of a name on `Object.prototype`.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import {
  createJali,
  layout,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  tabs,
  type Jali,
  type JaliOptions,
  type Layout,
  type ObjectRef,
} from "@jali/core";
import {
  browserLocation,
  buildSearch,
  createPaneKinds,
  createUrlSync,
  decodeRef,
  encodeRef,
  listCommands,
  readSearch,
  storeOf,
  structureKey,
  urlKeys,
  toLayout,
} from "@jali/core/adapter";
import { JaliRoot, definePane, usePaneState } from "@jali/react";
import { follow } from "../../core/src/actions/follow";
import { defaultFeatures, noUrl, urlSync } from "./features";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: () => null,
});
const kinds = createPaneKinds([note]);
const registry = kinds.registry();

const make = (options: Partial<JaliOptions> = {}): Jali =>
  createJali({
    panes: [note],
    layout: row(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" })),
    features: noUrl(),
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    ...options,
  });

/** A `?l=` code from the JSON a link holds, as the codec writes it. */
const linkOf = (value: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return `1.${btoa(Array.from(bytes, (c) => String.fromCharCode(c)).join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")}`;
};
const paneWithId = (id: string) =>
  linkOf([1, { i: id, t: "p", s: [1, 1], r: ["note", { id: 1 }] }]);
const twoPanes = (a = "a", b = "b") =>
  layout.encode(toLayout(row(pane(note({ id: 1 }), { id: a }), pane(note({ id: 2 }), { id: b }))));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

describe("C1: ids", () => {
  it("a link whose pane id holds a quote, a bracket or a space is broken, not opened", () => {
    for (const id of ['a"b', "a]b", "a b", "a\\b", "x".repeat(129)])
      expect(readSearch(`?l=${paneWithId(id)}`, registry)).toHaveProperty("broken");
  });

  it("ids Jali makes and builders give still validate", () => {
    const l = toLayout(
      row(
        note({ id: 1 }),
        tabs(note({ id: 2 }), note({ id: 3 })),
        pane(note({ id: 4 }), { id: "a.b:c_d-1" }),
      ),
    );
    expect(layout.validate(l, registry)).toEqual({ ok: true });
    expect(layout.tree.newId(l.root)).toMatch(/^[\w.:-]+$/);
  });

  it("a builder names a pane after a kind whose name has other characters with a safe id", () => {
    const odd = definePane("Order detail", { title: "Order", Component: () => null });
    const l = toLayout(row(odd(), odd()));
    expect(layout.validate(l, createPaneKinds([odd]).registry())).toEqual({ ok: true });
  });

  it("an id with a quote never reaches a selector unescaped", () => {
    // A layout with such ids never starts (core-opus CORE-1: every first layout is checked)...
    expect(() =>
      make({
        layout: tabs(pane(note({ id: 1 }), { id: 'q"1' }), pane(note({ id: 2 }), { id: 'q"]2' })),
      }),
    ).toThrow(/id must be/);
    // ...and a lookup by one is escaped all the same.
    const jali = make();
    expect(() => render(<JaliRoot jali={jali} />)).not.toThrow();
    const store = storeOf(jali);
    expect(() => store.dom.pane('q"1')).not.toThrow();
    expect(store.dom.pane('q"1')).toBeNull();
  });
});

describe("C2: stored settings", () => {
  it.each([["8"], [0], [1e9], [1.5], [null], [-3]])(
    "a stored paneCap of %j starts with the default",
    (cap) => {
      const storage = memoryStorage({ settings: JSON.stringify({ paneCap: cap, theme: "dark" }) });
      let jali: Jali | undefined;
      expect(() => (jali = make({ storage }))).not.toThrow();
      expect(jali!.get().settings.paneCap).toBe(8);
      // The fields that were fine are kept.
      expect(jali!.get().settings.theme).toBe("dark");
      expect(() => jali!.model().resolved).not.toThrow();
    },
  );

  it("a stored centreDrop Jali doesn't know is the default", () => {
    const storage = memoryStorage({ settings: JSON.stringify({ centreDrop: "explode" }) });
    expect(make({ storage }).get().settings.centreDrop).toBe("swap");
  });

  it("changeSettings refuses a value it can't use, and the workspace keeps working", () => {
    const jali = make();
    for (const patch of [
      { paneCap: 0 },
      { paneCap: "8" },
      { paneCap: 1e9 },
      { centreDrop: "x" },
      { theme: 3 },
    ])
      expect(jali.actions.changeSettings(patch as never)).toMatchObject({
        ok: false,
        reason: "invalid",
      });
    expect(jali.get().settings.paneCap).toBe(8);
    expect(() => jali.model().resolved).not.toThrow();
    expect(jali.actions.changeSettings({ paneCap: 4 })).toMatchObject({ ok: true });
    expect(jali.get().settings.paneCap).toBe(4);
  });

  it("a raw state write whose refit throws leaves the state as it was", () => {
    const jali = make();
    const store = storeOf(jali);
    const before = store.get();
    expect(() => store.set({ settings: { ...before.settings, paneCap: 0 } })).toThrow();
    expect(store.get()).toBe(before);
    expect(() => jali.model().resolved).not.toThrow();
  });
});

describe("C2b: stored sizes", () => {
  it("stored sizes that are null, wrong or carry other fields are left out", () => {
    const code = twoPanes();
    const l = layout.decode(code, registry)!;
    const sizes = {
      a: null,
      b: { size: { px: -4 }, ref: { kind: "constructor", params: {} }, type: "row", children: [] },
      row: { size: { weight: 2 }, userSized: "yes" },
    };
    const storage = memoryStorage({ sizes: JSON.stringify([[structureKey(l), sizes]]) });
    const sync = createUrlSync({ location: memoryLocation(`?l=${code}`), storage });
    let read: ReturnType<typeof sync.read> = null;
    expect(() => (read = sync.read(registry))).not.toThrow();
    expect(read).toHaveProperty("layout");
    const got = (read as unknown as { layout: Layout }).layout;
    expect(layout.validate(got, registry)).toEqual({ ok: true });
    expect(layout.tree.panes(got.root).map((p) => p.ref)).toEqual([
      note({ id: 1 }),
      note({ id: 2 }),
    ]);
    // The good part of an entry is kept.
    expect(got.root.size).toEqual({ weight: 2 });
    expect(() =>
      make({
        features: [...defaultFeatures(), urlSync({ location: memoryLocation(`?l=${code}`) })],
        storage,
      }),
    ).not.toThrow();
  });

  it.each([
    [{ a: { size: null } }],
    [{ a: { size: { px: "wide" } } }],
    [{ a: { size: { weight: 1, px: 2 } } }],
    [{ a: { base: { weight: -1 }, userSized: true } }],
  ])("stored sizes %j open the link as it is", (entry) => {
    const code = twoPanes();
    const l = layout.decode(code, registry)!;
    const storage = memoryStorage({ sizes: JSON.stringify([[structureKey(l), entry]]) });
    let jali: Jali | undefined;
    expect(
      () =>
        (jali = make({
          features: [...defaultFeatures(), urlSync({ location: memoryLocation(`?l=${code}`) })],
          storage,
        })),
    ).not.toThrow();
    expect(jali!.model().panes.map((p) => p.id)).toEqual(["a", "b"]);
    expect(layout.validate(jali!.getLayout(), registry)).toEqual({ ok: true });
  });
});

/**
 * `jali`'s layout with node `from` renamed `to`, written past every check: ids like these can't enter any way Jali
 * checks (tests/unsafe-ids.test.ts), and reads stay safe if one ever did.
 */
const smuggle = (jali: ReturnType<typeof make>, from: string, to: string) => {
  const store = storeOf(jali);
  const layout = structuredClone(store.get().layout) as unknown as { root: unknown };
  const walk = (n: any): void => {
    if (n.id === from) Object.defineProperty(n, "id", { value: to, enumerable: true });
    n.children?.forEach(walk);
  };
  walk(layout.root);
  store.set({ layout: layout as never, view: { ...store.get().view, focused: to } });
};

describe("C3: names on Object.prototype", () => {
  it.each(["constructor", "toString", "__proto__", "hasOwnProperty"])(
    "%s is not a kind",
    (kind) => {
      const jali = make();
      expect(jali.actions.openBeside("a", { kind, params: {} })).toMatchObject({
        ok: false,
        reason: "invalid",
      });
      expect(jali.model().panes).toHaveLength(2);
    },
  );

  it.each(["constructor", "toString", "__proto__", "valueOf"])(
    "a pane with id %s has no title, commands or work it never set",
    (id) => {
      const jali = make({
        layout: row(
          pane(note({ id: 1 }), { id: "list" }),
          pane(note({ id: 2 }), { id: "second", linkedTo: "list", follows: true }),
        ),
      });
      const store = storeOf(jali);
      smuggle(jali, "second", id);
      expect(jali.model().title(id)).toBe("Note 2");
      expect(() => listCommands(jali)).not.toThrow();
      // Not held for unsaved work it doesn't have: it follows its list.
      const r = store.apply((x) => follow(x, "list", note({ id: 3 })));
      expect(r.ok).toBe(true);
      expect(jali.model().pane(id)?.ref).toEqual(note({ id: 3 }));
    },
  );

  it("usePaneState in a pane with id constructor starts on its initial value", () => {
    const seen: unknown[] = [];
    const kept = definePane("kept", {
      title: "Kept",
      Component: () => {
        const [name] = usePaneState("name", "initial");
        const [ctor] = usePaneState("constructor", 0);
        seen.push(name, ctor);
        return null;
      },
    });
    const jali = createJali({
      panes: [kept],
      layout: row(pane(kept(), { id: "first" }), pane(kept(), { id: "other" })),
      features: noUrl(),
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
    });
    smuggle(jali as never, "first", "constructor");
    render(<JaliRoot jali={jali} />);
    expect(seen.length).toBeGreaterThan(0);
    for (let i = 0; i < seen.length; i += 2) {
      expect(seen[i]).toBe("initial");
      expect(seen[i + 1]).toBe(0);
    }
  });
});

describe("C4: refs passed to public actions", () => {
  const bad: [string, unknown][] = [
    ["an unknown kind", { kind: "typo", params: {} }],
    ["no params", { kind: "note" }],
    ["params that are not values", { kind: "note", params: { id: { nested: 1 } } }],
    ["a kind that is not text", { kind: 4, params: {} }],
    ["null", null],
  ];
  it.each(bad)(
    "%s is refused as invalid by every action that takes a ref, never thrown",
    (_, ref) => {
      const jali = make();
      const r = ref as ObjectRef;
      const results = [
        () => jali.actions.openBeside("a", r),
        () => jali.actions.openHere("a", r),
        () => jali.actions.addTab("a", r),
        () => jali.actions.peek("a", r),
        // `select(pane, null)` clears the selection, so null is no ref there.
        ...(r === null ? [] : [() => jali.actions.select("a", r)]),
      ].map((run) => {
        expect(run).not.toThrow();
        return run();
      });
      for (const out of results) {
        expect(out).toMatchObject({ ok: false, reason: "invalid" });
        expect(out.message).toBeTruthy();
      }
      expect(jali.model().panes).toHaveLength(2);
      expect(() => jali.model().resolved).not.toThrow();
    },
  );

  it("a pane named by something that is neither an id nor a ref is refused, not thrown", () => {
    const jali = make();
    expect(() => jali.actions.focus({ kind: "note" } as ObjectRef)).not.toThrow();
    expect(jali.actions.focus({ kind: "note" } as ObjectRef)).toMatchObject({
      ok: false,
      reason: "invalid",
    });
    expect(() => jali.actions.close(null as unknown as string)).not.toThrow();
    expect(jali.actions.close(null as unknown as string)).toMatchObject({
      ok: false,
      reason: "invalid",
    });
    // A well-formed ref of a kind the workspace doesn't have names no pane.
    expect(jali.actions.close({ kind: "typo", params: {} })).toMatchObject({
      ok: false,
      reason: "not-found",
    });
    expect(jali.model().panes).toHaveLength(2);
  });
});

describe("C5: maximising a pane that is not on screen", () => {
  const hidden = () =>
    make({
      layout: row(
        pane(note({ id: 1 }), { id: "a" }),
        pane(note({ id: 2 }), { id: "b" }),
        pane(note({ id: 3 }), { id: "c", hidden: true }),
      ),
    });

  it("toggleZoom and toggleFullScreen refuse a hidden pane", () => {
    const jali = hidden();
    expect(jali.actions.toggleZoom("c")).toMatchObject({ ok: false, reason: "blocked" });
    expect(() => jali.model().resolved).not.toThrow();
    expect(jali.actions.toggleFullScreen("c")).toMatchObject({ ok: false, reason: "blocked" });
    expect(() => jali.model().resolved).not.toThrow();
    expect(jali.get().view.zoomed).toBeUndefined();
  });

  it("a zoomed view on a hidden pane resolves", () => {
    const jali = hidden();
    const store = storeOf(jali);
    store.set({ view: { ...store.get().view, zoomed: "c" } });
    expect(() => jali.model().resolved).not.toThrow();
  });

  it("a link zooming a hidden pane opens unzoomed", () => {
    const l = toLayout(
      row(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "c", hidden: true })),
    );
    const read = readSearch(`?l=${layout.encode(l)}&zoom=c`, registry);
    expect(read).toHaveProperty("layout");
    expect(read!.view.zoomed).toBeUndefined();
  });
});

describe("C6: limits on what a link opens", () => {
  it("a page link's open= is capped and de-duplicated", () => {
    const q = new URLSearchParams({ page: "p", item: "1" });
    for (let i = 0; i < 10_000; i++) q.append("open", encodeRef(note({ id: i % 50 })));
    q.append("open", encodeRef(note({ id: 1 })));
    const read = readSearch(`?${q}`, registry);
    const opened = read && "page" in read ? read.page.investigation : [];
    expect(opened.length).toBeLessThanOrEqual(32);
    expect(new Set(opened.map((r) => encodeRef(r))).size).toBe(opened.length);
    expect(opened[0]).toEqual(note({ id: 0 }));
  });

  it("a layout of more than 256 nodes is refused", () => {
    const many = toLayout(row(...Array.from({ length: 300 }, (_, i) => note({ id: i }))));
    expect(layout.validate(many, registry).ok).toBe(false);
    const fine = toLayout(row(...Array.from({ length: 100 }, (_, i) => note({ id: i }))));
    expect(layout.validate(fine, registry).ok).toBe(true);
  });
});

describe("C7: the address", () => {
  it("a path that starts with // stays on this origin", () => {
    const calls: string[] = [];
    const win = {
      location: {
        href: "https://app.test//evil.com/x?l=1#top",
        pathname: "//evil.com/x",
        search: "?l=1",
        hash: "#top",
        origin: "https://app.test",
      },
      history: {
        replaceState: (_: unknown, __: string, url: string) => void calls.push(url),
        pushState: (_: unknown, __: string, url: string) => void calls.push(url),
      },
      addEventListener() {},
      removeEventListener() {},
    } as unknown as Window;
    browserLocation(win).navigate("?l=2", "replace");
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0]!, win.location.href);
    expect(url.origin).toBe("https://app.test");
    expect(url.pathname).toBe("//evil.com/x");
    expect(url.search).toBe("?l=2");
    expect(url.hash).toBe("#top");
    browserLocation(win).navigate("?l=1", "replace");
    expect(calls).toHaveLength(1);
  });
});

describe("P17: what a link carries reads back as written", () => {
  it.each(["#123", "!true", "!false", "a~b", "a=b", "%", "50%25", "~", "#", "!", "%7E", ""])(
    "a text value %j",
    (text) => {
      const ref = { kind: "note", params: { id: 1, text } };
      expect(decodeRef(encodeRef(ref))).toEqual(ref);
    },
  );
  it("a key with ~ = # ! %", () => {
    const ref = {
      kind: "note",
      params: { "a~b": 1, "c=d": "e", "#f": true, "!g": "h", "%i": "j" },
    };
    expect(decodeRef(encodeRef(ref))).toEqual(ref);
  });
  it("links from before still read the same", () => {
    expect(decodeRef("order~id=#42~tab=lines~draft=!true")).toEqual({
      kind: "order",
      params: { id: 42, tab: "lines", draft: true },
    });
    expect(encodeRef({ kind: "order", params: { id: 4, tab: "lines", draft: true } })).toBe(
      "order~id=#4~tab=lines~draft=!true",
    );
  });
  it("a page link's open= carries such text through the address; an older link's peek= is ignored", () => {
    const ref = { kind: "note", params: { id: 1, text: "#123~!true" } };
    const q = new URLSearchParams({ page: "p", item: "1", peek: encodeRef(ref) });
    q.append("open", encodeRef(ref));
    const read = readSearch(`?${q}`, registry);
    expect(read && "page" in read && read.page.investigation).toEqual([ref]);
    expect(read?.view.peek).toBeUndefined();
  });
});

describe("P17b: the host's params beside a prefixed workspace", () => {
  it("a prefixed workspace keeps the host's app and arr, and reads no ?app=review", () => {
    const jali = make();
    const s = storeOf(jali).get();
    const search = buildSearch("?app=billing&arr=3", s, urlKeys("w."));
    const q = new URLSearchParams(search);
    expect(q.get("app")).toBe("billing");
    expect(q.get("arr")).toBe("3");
    expect(q.get("w.l")).toBeTruthy();
    expect(readSearch("?app=review&item=1", registry, urlKeys("w."))).toBeNull();
    // The workspace without a prefix still reads the old form.
    expect(readSearch("?app=review&item=1", registry)).toHaveProperty("page");
  });
});
