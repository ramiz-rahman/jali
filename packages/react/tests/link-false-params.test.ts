/**
 * Params the address doesn't hold (Data Studio FINDINGS.md #2): `optional(type, { link: false })` is the pane's own
 * state for this page load, kept out of every link Jali writes, but part of what the pane shows, and still set by a
 * link that carries it. Back and Forward keep it, and an `appOnly` param, on a pane still open; a reload keeps what
 * the preset the link names gave its panes, and only for a pane that matches it exactly.
 */
import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import {
  appOnly,
  createJali,
  memoryLocation,
  memoryStorage,
  optional,
  pane,
  row,
  type ParamsOf,
} from "@jali/core";
import { definePane } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";
import { layout } from "@jali/core/adapter";

const chartParams = { runId: optional(String, { link: false }) };
const chart = definePane("chart", {
  params: chartParams,
  title: "Chart",
  Component: () => null,
});
const query = definePane("query", {
  params: { sql: String, autorun: appOnly(Boolean) },
  title: ({ sql }) => `Query ${sql}`,
  Component: () => null,
});

const presets = [
  { id: "blank", label: "Blank", layout: () => pane(chart(), { id: "c" }) },
  {
    id: "report",
    label: "Report",
    layout: () =>
      row(
        pane(query({ sql: "select 1", autorun: true }), { id: "q" }),
        pane(chart({ runId: "" }), { id: "c" }),
      ),
  },
];
const make = (location = memoryLocation()) =>
  createJali({
    panes: [query, chart],
    presets,
    preset: "report",
    features: [...defaultFeatures(), urlSync({ location })],
    storage: memoryStorage(),
    size: { width: 1600, height: 900 },
    moveFocus: false,
  });
const refOf = (jali: ReturnType<typeof make>, id: string) =>
  layout.tree.panes(jali.getLayout().root).find((p) => p.id === id)?.ref;

describe("a link: false param", () => {
  it("is optional in the kind's params", () => {
    expectTypeOf<ParamsOf<typeof chartParams>>().toEqualTypeOf<{ runId?: string }>();
  });

  it("stays out of the address and Copy link", () => {
    const jali = make();
    jali.actions.openHere("c", chart({ runId: "run-7" }));
    expect(refOf(jali, "c")?.params).toEqual({ runId: "run-7" });
    expect(jali.href()).not.toMatch(/run-7/);
  });

  it("is part of what the pane shows: another value is another object", () => {
    const jali = make();
    jali.actions.openHere("c", chart({ runId: "run-1" }));
    const r = jali.actions.openBeside("q", chart({ runId: "run-2" }));
    expect(r.ok).toBe(true);
    expect(r.pane).not.toBe("c");
    expect(refOf(jali, "c")?.params).toEqual({ runId: "run-1" });
  });

  it("is set by a link that carries it", () => {
    const writer = make();
    const crafted = layout.encode({
      ...writer.getLayout(),
      root: layout.tree.map(writer.getLayout().root, (n) =>
        n.type === "pane" && n.ref.kind === "chart"
          ? { ...n, ref: { ...n.ref, params: { runId: "from-a-link" } } }
          : n,
      ),
    });
    const jali = make(memoryLocation(`?l=${crafted}`));
    expect(refOf(jali, "c")?.params).toEqual({ runId: "from-a-link" });
  });

  it("is kept by Back and Forward on a pane that is still open", () => {
    const location = memoryLocation();
    const jali = make(location);
    const stop = jali.start();
    jali.actions.openHere("c", chart({ runId: "run-7" }));
    const before = location.search();
    jali.actions.close("q");
    location.visit(before);
    expect(refOf(jali, "q")).toBeDefined();
    expect(refOf(jali, "c")?.params).toEqual({ runId: "run-7" });
    stop();
  });
});

describe("what the address doesn't hold, after a reload", () => {
  it("comes from the preset the link names, for a pane that matches it", () => {
    const first = make();
    const search = new URL(first.href(), "http://x").search;
    expect(search).toMatch(/preset=report/);
    expect(search).not.toMatch(/autorun/);
    // A workspace that opens on another preset: only the link's preset can give the query its autorun.
    const reloaded = createJali({
      panes: [query, chart],
      presets,
      preset: "blank",
      features: [...defaultFeatures(), urlSync({ location: memoryLocation(search) })],
      storage: memoryStorage(),
      size: { width: 1600, height: 900 },
      moveFocus: false,
    });
    expect(refOf(reloaded, "q")?.params).toEqual({ sql: "select 1", autorun: true });
  });

  it("never reaches a pane the link changed: a link still can't set an app-only param", () => {
    const first = make();
    const crafted = layout.encode({
      ...first.getLayout(),
      root: layout.tree.map(first.getLayout().root, (n) =>
        n.type === "pane" && n.ref.kind === "query"
          ? { ...n, ref: { kind: "query", params: { sql: "drop table" } } }
          : n,
      ),
    });
    const jali = make(memoryLocation(`?l=${crafted}&preset=report`));
    expect(refOf(jali, "q")?.params).toEqual({ sql: "drop table" });
  });
});
