/**
 * Params only the app sets (`appOnly`, QUALITY-REVIEW C12): a link never carries one and never sets one, so a link
 * can't make a query run as it opens. Data Studio's `autorun` is the case.
 */
import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import {
  appOnly,
  createJali,
  layout,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  toLayout,
  type AnyJali,
  type ParamsOf,
  type UrlState,
} from "@jali/core";
import { definePageEngine as definePage } from "@jali/core/adapter";
import { encodePeek, storeOf } from "@jali/core/adapter";
import { definePane } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

const queryParams = { sql: String, autorun: appOnly(Boolean) };
const query = definePane("query", {
  params: queryParams,
  title: ({ sql }) => `Query ${sql}`,
  Component: () => null,
});
const list = definePane("list", { title: "Queries", Component: () => null });

const make = (search = "") => {
  const location = memoryLocation(search);
  const jali = createJali({
    panes: [query, list],
    layout: row(list(), query({ sql: "select 1" })),
    features: [...defaultFeatures(), urlSync({ location })],
    storage: memoryStorage(),
    size: { width: 1600, height: 900 },
    moveFocus: false,
  });
  return { jali, location };
};
const refs = (jali: AnyJali) => layout.tree.panes(jali.getLayout().root).map((p) => p.ref);

describe("a param only the app sets", () => {
  it("is optional in the kind's params", () => {
    expectTypeOf<ParamsOf<typeof queryParams>>().toEqualTypeOf<{
      sql: string;
      autorun?: boolean;
    }>();
  });

  it("is never read from a link: the layout, a peek or a page's opened panes", () => {
    const { jali: writer } = make();
    writer.actions.openBeside(
      writer.model().panes[0]!.id,
      query({ sql: "drop table", autorun: true }),
    );
    // A link that carries autorun, as a crafted link would.
    const crafted = layout.encode({
      ...writer.getLayout(),
      root: layout.tree.map(writer.getLayout().root, (n) =>
        n.type === "pane" && n.ref.kind === "query"
          ? { ...n, ref: { ...n.ref, params: { ...n.ref.params, autorun: true } } }
          : n,
      ),
    });
    const peek = encodeURIComponent(encodePeek(query({ sql: "peeked", autorun: true })));
    const { jali } = make(`?l=${crafted}&peek=${peek}`);
    for (const ref of refs(jali)) expect(ref.params).not.toHaveProperty("autorun");
    expect(refs(jali).some((r) => r.params.sql === "drop table")).toBe(true);
    expect(jali.get().view.peek?.params).toEqual({ sql: "peeked" });
  });

  it("is dropped from a peek's ref once its kind is registered, if it wasn't when the link was read", () => {
    const peek = encodeURIComponent(encodePeek(query({ sql: "peeked", autorun: true })));
    const lists = layout.encode(toLayout(row(list())));
    // A workspace whose query kind arrives later (a lazily loaded module): the link is read without it.
    const jali = createJali({
      panes: [list],
      layout: row(list()),
      features: [
        ...defaultFeatures(),
        urlSync({ location: memoryLocation(`?l=${lists}&peek=${peek}`) }),
      ],
      storage: memoryStorage(),
      size: { width: 1600, height: 900 },
      moveFocus: false,
    });
    // Kept whole meanwhile (the sheet says its kind is missing): which param only the app sets isn't known yet.
    expect(jali.get().view.peek?.params).toEqual({ sql: "peeked", autorun: true });

    storeOf(jali).env.kinds.register({ kind: "query", title: "Query", params: queryParams });
    expect(jali.get().view.peek?.params).toEqual({ sql: "peeked" });
    // Opened full, its pane doesn't get it either.
    storeOf(jali).actions.openPeekFull();
    expect(refs(jali).find((r) => r.kind === "query")?.params).toEqual({ sql: "peeked" });
  });

  it("set by the app on a kind registered later is kept: only a link's refs are read again", () => {
    const { jali } = make();
    const peekRef = query({ sql: "mine", autorun: true });
    jali.actions.peek(jali.model().panes[0]!.id, peekRef);
    storeOf(jali).env.kinds.register({ kind: "other", title: "Other" });
    expect(jali.get().view.peek?.params).toEqual({ sql: "mine", autorun: true });
  });

  it("is kept from a writer of the host's own: not in the page's way back either", () => {
    const visit = definePane("visit", {
      params: { id: Number, autorun: appOnly(Boolean) },
      title: ({ id }) => `Visit ${id}`,
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
      bind: (item: number) => ({ summary: visit({ id: item, autorun: true }) }),
      build: (item: number) =>
        pane(visit({ id: item, autorun: true }), { id: "summary", role: "summary" }),
    });
    const written: UrlState[] = [];
    const jali = createJali({
      panes: [visit, query],
      page,
      url: { write: (state) => void written.push(state()) },
      storage: memoryStorage(),
      size: { width: 2000, height: 800 },
      moveFocus: false,
    });
    expect(layout.tree.panes(jali.getLayout().root)[0]!.ref.params).toHaveProperty("autorun");
    storeOf(jali).run("page.setMode", "split");
    jali.actions.openBeside("summary", query({ sql: "select 1", autorun: true }));
    const last = written.at(-1)!;
    expect(last.page?.before).toBeDefined();
    for (const l of [last.layout, last.page!.before!])
      for (const p of layout.tree.panes(l.root)) expect(p.ref.params).not.toHaveProperty("autorun");
    // The workspace itself keeps them: Back to the page's layout is exact.
    expect(layout.tree.panes(storeOf(jali).get().page!.before!.root)[0]!.ref.params).toHaveProperty(
      "autorun",
    );
  });

  it("is kept by Back and Forward on a curated page's opened pane that is still open", () => {
    const visit = definePane("visit", {
      params: { id: Number },
      title: ({ id }) => `Visit ${id}`,
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
    const location = memoryLocation();
    const jali = createJali({
      panes: [visit, query],
      page,
      features: [...defaultFeatures(), urlSync({ location })],
      storage: memoryStorage(),
      size: { width: 2400, height: 800 },
      moveFocus: false,
    });
    const stop = jali.start();
    storeOf(jali).run("page.setMode", "split");
    jali.actions.openBeside("summary", query({ sql: "select 1", autorun: true }));
    const opened = () => refs(jali).filter((r) => r.kind === "query");
    expect(opened()).toEqual([query({ sql: "select 1", autorun: true })]);
    const before = location.search();
    expect(before).not.toContain("autorun");
    const first = layout.tree.panes(jali.getLayout().root).find((p) => p.ref.kind === "query")!;
    jali.actions.openBeside(first.id, query({ sql: "select 2" }));
    expect(opened()).toHaveLength(2);
    // Back: the address holds the first opened pane without autorun; the pane on screen keeps it.
    location.visit(before);
    expect(opened()).toEqual([query({ sql: "select 1", autorun: true })]);
    stop();
  });

  it("doesn't break a link that holds a value it can't read: the link opens, without it", () => {
    const { jali: writer } = make();
    const crafted = layout.encode({
      ...writer.getLayout(),
      root: layout.tree.map(writer.getLayout().root, (n) =>
        n.type === "pane" && n.ref.kind === "query"
          ? { ...n, ref: { ...n.ref, params: { ...n.ref.params, autorun: "banana" } } }
          : n,
      ),
    });
    const { jali } = make(`?l=${crafted}`);
    expect(refs(jali).find((r) => r.kind === "query")?.params).toEqual({ sql: "select 1" });
  });

  it("is set by the app, kept in the pane, and left out of the address", () => {
    const { jali, location } = make();
    const r = jali.actions.openBeside(
      jali.model().panes[0]!.id,
      query({ sql: "select 2", autorun: true }),
    );
    expect(r.ok).toBe(true);
    expect(refs(jali).find((x) => x.params.sql === "select 2")?.params.autorun).toBe(true);
    const address = location.entries.at(-1)!;
    const written = layout.decode(
      new URLSearchParams(address).get("l")!,
      jali.env.kinds.registry(),
    );
    const shown = layout.tree.panes(written!.root).map((p) => p.ref);
    expect(shown.find((x) => x.params.sql === "select 2")?.params).toEqual({ sql: "select 2" });
    expect(jali.href()).not.toMatch(/autorun/);
  });

  it("is not part of what the pane shows: with or without it, it is the same object", () => {
    const { jali } = make();
    const kinds = jali.env.kinds;
    const plain = query({ sql: "select 1" }),
      running = query({ sql: "select 1", autorun: true });
    expect(kinds.sameObject(plain, running)).toBe(true);
    expect(kinds.identityOf(running)).toBe(kinds.identityOf(plain));
    expect(kinds.sameObject(plain, query({ sql: "select 2" }))).toBe(false);
  });
});
