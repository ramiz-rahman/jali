/**
 * linkSearch (20 Nov 2026): a host builds a link to a page, its opened panes and the peek, or to a layout, with no
 * workspace running. Reading the link back gives exactly what it was built from.
 */
import { describe, expect, it } from "vite-plus/test";
import {
  appOnly,
  createJali,
  definePage,
  linkSearch,
  memoryLocation,
  memoryStorage,
  optional,
  pane,
  row,
  toLayout,
  type JaliOptions,
} from "@jali/core";
import { definePane } from "@jali/react";
import { readSearch } from "../../core/src/url";

const visit = definePane("visit", {
  params: { id: Number },
  title: ({ id }) => `Visit ${id}`,
  width: { min: 200 },
  Component: () => null,
});
const call = definePane("call", {
  params: { slug: String, t: String },
  title: ({ slug }) => `Call ${slug}`,
  width: { min: 200 },
  Component: () => null,
});
const page = definePage({
  id: "visit",
  name: "Visit",
  itemNoun: "visit",
  home: "summary",
  roles: [{ id: "summary", label: "Summary", priority: "primary" as const }],
  firstItem: 1,
  bind: (item: number) => ({ summary: visit({ id: item }) }),
  build: (item: number) => pane(visit({ id: item }), { id: "summary", role: "summary" }),
});
const at = (search: string, options: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [visit, call],
    page,
    url: { location: memoryLocation(search) },
    storage: memoryStorage(),
    size: { width: 2000, height: 800 },
    moveFocus: false,
    ...options,
  });
const kinds = () => at("").model().env.kinds.registry();

/** Text a ref's encoding gives a meaning to, so it must come back as it went. */
const odd = call({ slug: "demra~1", t: "#1=a!%" });

describe("a page link", () => {
  const link = {
    page: "visit",
    item: 7,
    tab: "summary",
    open: [odd],
    peek: call({ slug: "x", t: "2" }),
  };

  it("reads back as the page, item, view, opened panes and peek it was built from", () => {
    expect(readSearch(linkSearch(link), kinds())).toEqual({
      page: { page: "visit", tab: "summary", item: "7", investigation: [odd] },
      view: { peek: call({ slug: "x", t: "2" }) },
    });
  });

  it("opens a workspace on them, and the workspace writes the same link", () => {
    const search = linkSearch(link);
    const jali = at(search);
    expect(jali.get().page).toMatchObject({ profile: "visit", item: 7, mode: "split" });
    expect(
      jali
        .model()
        .panes.filter((p) => !p.role)
        .map((p) => p.ref),
    ).toEqual([odd]);
    expect(jali.get().view.peek).toEqual(call({ slug: "x", t: "2" }));
    // The same params; the order may differ, as the address already had some.
    const params = (text: string) => [...new URLSearchParams(text)].sort();
    expect(params(jali.href().replace(/^memory:/, ""))).toEqual(params(search));
  });

  it("leaves out what it isn't given: the reader's own item and view are used", () => {
    expect(linkSearch({ page: "visit" })).toBe("?page=visit");
    expect(readSearch("?page=visit", kinds())).toEqual({
      page: { page: "visit", tab: "", item: undefined, investigation: [] },
      view: {},
    });
  });

  it("keeps the host's own params and replaces the workspace's, under its prefix", () => {
    expect(
      linkSearch({ page: "visit", item: 7 }, { prefix: "w.", search: "?q=demra&w.l=old&w.peek=x" }),
    ).toBe("?q=demra&w.page=visit&w.item=7");
  });
});

describe("a layout link", () => {
  it("reads back as the layout, preset, maximised pane and peek", () => {
    const input = row(
      pane(visit({ id: 1 }), { id: "a" }),
      pane(call({ slug: "x", t: "1" }), { id: "b" }),
    );
    const search = linkSearch({
      layout: input,
      preset: "review",
      zoom: "b",
      peek: visit({ id: 2 }),
    });
    expect(readSearch(search, kinds())).toEqual({
      layout: toLayout(input),
      view: { zoomed: "b", peek: visit({ id: 2 }) },
      preset: "review",
    });
  });

  it("opens a free workspace on that layout", () => {
    const input = row(pane(visit({ id: 1 }), { id: "a" }), pane(visit({ id: 3 }), { id: "b" }));
    const jali = createJali({
      panes: [visit, call],
      layout: row(visit({ id: 9 })),
      url: { location: memoryLocation(linkSearch({ layout: input, peek: visit({ id: 2 }) })) },
      storage: memoryStorage(),
      size: { width: 2000, height: 800 },
      moveFocus: false,
    });
    expect(jali.model().panes.map((p) => [p.id, p.ref])).toEqual([
      ["a", visit({ id: 1 })],
      ["b", visit({ id: 3 })],
    ]);
    expect(jali.get().view.peek).toEqual(visit({ id: 2 }));
  });
});

describe("a link built with no workspace", () => {
  const query = definePane("query", {
    params: { sql: String, autorun: appOnly(Boolean), cursor: optional(Number, { link: false }) },
    title: ({ sql }) => `Query ${sql}`,
    Component: () => null,
  });
  const params = (search: string, key: string) => new URLSearchParams(search).getAll(key).join(" ");

  it("leaves out app-only and link: false params of refs a kind's call built", () => {
    const ref = query({ sql: "select 1", autorun: true, cursor: 4 });
    const pageLink = linkSearch({ page: "visit", open: [ref], peek: ref });
    for (const key of ["open", "peek"]) {
      expect(params(pageLink, key)).toBe("query~sql=select 1");
    }
    const layoutLink = linkSearch({ layout: row(ref), peek: ref });
    expect(params(layoutLink, "peek")).toBe("query~sql=select 1");
    expect(layoutLink).not.toMatch(/autorun|cursor/);
    // The ref itself keeps them: they are the app's.
    expect(ref.params).toEqual({ sql: "select 1", autorun: true, cursor: 4 });
  });

  it("leaves them out of a live layout's and peek's refs when given the workspace's panes", () => {
    // Refs as a workspace holds them: plain objects, not built by the kind's call.
    const plain = { kind: "query", params: { sql: "select 1", autorun: true, cursor: 4 } };
    const live = { kind: "query", params: { ...plain.params } };
    expect(linkSearch({ layout: row(live), peek: plain }, { panes: [query] })).not.toMatch(
      /autorun|cursor/,
    );
    expect(params(linkSearch({ page: "visit", open: [plain] }, { panes: [query] }), "open")).toBe(
      "query~sql=select 1",
    );
  });
});
