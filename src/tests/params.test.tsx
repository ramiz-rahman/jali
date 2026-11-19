/**
 * Typed params (19 Nov 2026): optional params, flags and fixed choices, what happens to a ref its kind can't read, and
 * that every new value goes through every place a ref is written down (?l=, peek=, open=, saved layouts), with links
 * made before the change still opening as they did.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, expectTypeOf, it } from "vite-plus/test";
import {
  createJali,
  layout,
  memoryLocation,
  memoryStorage,
  oneOf,
  optional,
  pane,
  row,
  toLayout,
  type ObjectRef,
  type ParamsOf,
} from "@jali/core";
import {
  buildSearch,
  createPaneKinds,
  decodePeek,
  encodePeek,
  loadPrefs,
  parseParams,
  readSearch,
  savePrefs,
} from "@jali/core/adapter";
import { JaliRoot, definePane, type PaneProps } from "@jali/react";

// A kind with every param type, declared first so its component is typed from it.
const orderParams = {
  id: Number,
  tab: optional(String),
  draft: optional(Boolean),
  status: optional(oneOf("open", "closed")),
};
function OrderView({ params }: PaneProps<typeof orderParams>) {
  return (
    <h3>
      Order {params.id} {params.tab ?? "summary"} {params.status ?? "any"}
      {params.draft ? " (draft)" : ""}
    </h3>
  );
}
const order = definePane("order", {
  params: orderParams,
  title: ({ id, tab }) => (tab ? `Order ${id} · ${tab}` : `Order ${id}`),
  Component: OrderView,
});
const kinds = createPaneKinds([order]);
const registry = kinds.registry();

const make = (search = "") =>
  createJali({
    panes: [order],
    layout: row(order({ id: 1 })),
    url: { location: memoryLocation(search) },
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });

/** A `?l=` code from the JSON a link holds, as the codec writes it. */
const linkOf = (value: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return `1.${btoa(Array.from(bytes, (c) => String.fromCharCode(c)).join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")}`;
};
const onePane = (params: Record<string, unknown>, kind = "order") =>
  linkOf([1, { i: "a", t: "p", s: [1, 1], r: [kind, params] }]);

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

describe("declaring params", () => {
  it("types the component, the title and the ref maker, with optional params optional", () => {
    expectTypeOf<ParamsOf<typeof orderParams>>().toEqualTypeOf<{
      id: number;
      tab?: string;
      draft?: boolean;
      status?: "open" | "closed";
    }>();
    expectTypeOf<PaneProps<typeof orderParams>["params"]>().toEqualTypeOf<
      ParamsOf<typeof orderParams>
    >();
    // Params' own type still works as before.
    expectTypeOf<PaneProps<{ id: number }>["params"]>().toEqualTypeOf<{ id: number }>();

    expect(order({ id: 1 })).toEqual({ kind: "order", params: { id: 1 } });
    expect(order({ id: 1, tab: "lines", draft: true, status: "open" }).params).toEqual({
      id: 1,
      tab: "lines",
      draft: true,
      status: "open",
    });
    // @ts-expect-error: an order needs its id
    order({ tab: "lines" });
    // @ts-expect-error: the id is a number
    order({ id: "1" });
    // @ts-expect-error: a flag is a boolean
    order({ id: 1, draft: "yes" });
    // @ts-expect-error: the status is one of its values
    order({ id: 1, status: "lost" });
    // @ts-expect-error: a kind that declares its params takes no others
    order({ id: 1, colour: "red" });
  });

  it("leaves an optional param given as undefined out of the ref, as a link would", () => {
    expect(order({ id: 1, tab: undefined })).toEqual({ kind: "order", params: { id: 1 } });
  });

  it("makes the ref maker's params optional when every param is", () => {
    const search = definePane("search", {
      params: { q: optional(String) },
      title: "Search",
      Component: () => null,
    });
    expect(search()).toEqual({ kind: "search", params: {} });
  });

  it("keeps undeclared kinds taking any plain values", () => {
    const loose = definePane("loose", { title: "Loose", Component: () => null });
    expect(loose({ a: 1, b: "x", c: true }).params).toEqual({ a: 1, b: "x", c: true });
  });
});

describe("reading params", () => {
  it.each([
    ["Number", { id: Number }, { id: "7" }, { id: 7 }],
    ["Number", { id: Number }, { id: 7 }, { id: 7 }],
    ["String", { id: String }, { id: 7 }, { id: "7" }],
    ["Boolean", { on: Boolean }, { on: true }, { on: true }],
    ["Boolean as text", { on: Boolean }, { on: "false" }, { on: false }],
    ["Boolean from an older 1", { on: Boolean }, { on: 1 }, { on: true }],
    ["oneOf", { s: oneOf("open", "closed") }, { s: "open" }, { s: "open" }],
    ["oneOf of numbers, from text", { n: oneOf(10, 25) }, { n: "25" }, { n: 25 }],
    ["a function", { d: (v: unknown) => String(v).toUpperCase() }, { d: "a" }, { d: "A" }],
  ])("reads %s", (_, types, params, read) => {
    expect(parseParams(types, params)).toEqual({ params: read, problems: [] });
  });

  it.each([
    ["Number", { id: Number }, "abc"],
    ["Number from empty text", { id: Number }, ""],
    ["Boolean", { on: Boolean }, "yes"],
    ["oneOf", { s: oneOf("open", "closed") }, "lost"],
    [
      "a function that throws",
      {
        d: () => {
          throw new Error("no");
        },
      },
      "x",
    ],
  ])("reports a value %s can't read", (_, types, value) => {
    const key = Object.keys(types)[0]!;
    expect(parseParams(types, { [key]: value }).problems).toEqual([{ param: key, value }]);
  });

  it("reports a missing required param, never a missing optional one, and keeps undeclared params", () => {
    expect(parseParams(orderParams, { tab: "x", extra: 1 })).toEqual({
      params: { tab: "x", extra: 1 },
      problems: [{ param: "id" }],
    });
    expect(parseParams(orderParams, { id: 1 }).problems).toEqual([]);
  });
});

describe("a ref its kind can't read", () => {
  it("shows a clear error in its pane instead of the component", () => {
    const jali = createJali({
      panes: [order],
      layout: row(pane({ kind: "order", params: { tab: "lines" } }, { id: "broken" })),
      url: false,
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
    });
    render(<JaliRoot jali={jali} />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("This order can’t open.");
    expect(alert.textContent).toContain("Its link has no “id”.");
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
    // Its title is the kind's name, and it stays out of Recent.
    expect(jali.model().title("broken")).toBe("order");
    expect(jali.env.kinds.isRecordable({ kind: "order", params: {} })).toBe(false);
  });

  it("makes a layout link holding it broken", () => {
    const result = layout.validate(
      {
        version: 1,
        root: {
          id: "a",
          type: "pane",
          size: { weight: 1 },
          ref: { kind: "order", params: { status: "lost" } },
        },
      },
      registry,
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors.join()).toMatch(/"id" is missing; "status" can't be read from "lost"/);
    expect(readSearch(`?l=${onePane({ tab: "x" })}`, registry)).toEqual({
      broken: onePane({ tab: "x" }),
      view: {},
    });
  });

  it("is left out of a peek and a page's opened panes", () => {
    const read = readSearch(
      "?page=p&item=1&open=order~tab=x&open=order~id=%232&peek=order~id=lost",
      registry,
    );
    expect(read).toEqual({
      page: { tab: "", item: "1", investigation: [order({ id: 2 })] },
      view: {},
    });
  });
});

describe("every new value goes through every link", () => {
  const full = order({ id: 4, tab: "lines", draft: true, status: "closed" });
  const off = order({ id: 5, draft: false });

  it("the layout link (?l=)", () => {
    const first = make();
    const beside = first.actions.openBeside("order", full)!;
    first.actions.openBeside(beside, off);
    const search = buildSearch("", first.get());
    const read = readSearch(search, registry);
    expect(read && "layout" in read).toBe(true);
    if (read && "layout" in read)
      expect(layout.tree.panes(read.layout.root).map((p) => p.ref)).toEqual([
        order({ id: 1 }),
        full,
        off,
      ]);
    const again = make(search);
    expect(again.model().panes.map((p) => p.ref)).toEqual([order({ id: 1 }), full, off]);
    expect(again.env.kinds.params(off)).toEqual({ id: 5, draft: false });
  });

  it("the peek (peek=)", () => {
    for (const ref of [full, off]) expect(decodePeek(encodePeek(ref))).toEqual(ref);
    expect(encodePeek(full)).toBe("order~id=#4~tab=lines~draft=!true~status=closed");
    const read = readSearch(
      `?l=${onePane({ id: 1 })}&peek=${encodeURIComponent(encodePeek(off))}`,
      registry,
    );
    expect(read?.view.peek).toEqual(off);
  });

  it("a curated page's opened panes (open=)", () => {
    const q = new URLSearchParams({ page: "p", item: "1" });
    for (const ref of [full, off]) q.append("open", encodePeek(ref));
    const read = readSearch(`?${q}`, registry);
    expect(read && "page" in read && read.page.investigation).toEqual([full, off]);
  });

  it("a saved layout", () => {
    const storage = memoryStorage();
    const split = toLayout(row(full, off));
    savePrefs(storage, "p", { mode: "split", split });
    expect(loadPrefs(storage, "p", registry).split).toEqual(split);
  });
});

describe("links made before typed params still open as they did", () => {
  it("a layout link with a numeric flag reads it as a flag", () => {
    const flag = definePane("query", {
      params: { sql: optional(String), autorun: optional(Boolean) },
      title: "Query",
      Component: () => null,
    });
    const reg = createPaneKinds([flag]).registry();
    const read = readSearch(`?l=${onePane({ sql: "select 1", autorun: 1 }, "query")}`, reg);
    expect(read && "layout" in read).toBe(true);
    const ref = read && "layout" in read ? layout.tree.panes(read.layout.root)[0]!.ref : null;
    expect(ref).toEqual({ kind: "query", params: { sql: "select 1", autorun: 1 } });
    expect(createPaneKinds([flag]).params(ref!)).toEqual({ sql: "select 1", autorun: true });
    // A query with no params at all, as a new one is.
    expect(readSearch(`?l=${onePane({}, "query")}`, reg)).toHaveProperty("layout");
  });

  it("a peek written by the old encoder decodes to the same ref", () => {
    const old: ObjectRef = { kind: "order", params: { id: 42, tab: "lines" } };
    expect(decodePeek("order~id=#42~tab=lines")).toEqual(old);
    expect(encodePeek(old)).toBe("order~id=#42~tab=lines");
  });

  it("a layout link with params as text, read back with their types", () => {
    const read = readSearch(`?l=${onePane({ id: "12", tab: "notes" })}`, registry);
    const ref = read && "layout" in read ? layout.tree.panes(read.layout.root)[0]!.ref : null;
    expect(kinds.params(ref!)).toEqual({ id: 12, tab: "notes" });
  });
});
