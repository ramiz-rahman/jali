/** Data Studio's workspace, in memory: what a reload brings back, a table's tab menu, and its words. */
import { describe, expect, it } from "vite-plus/test";
import { en, memoryLocation, memoryStorage } from "jali-layout";
import { paneStateOf, reportPaneState } from "jali-layout/testing";
import { urlSync } from "jali-layout/url";
import { tableRef } from "@jali-examples/shared/panes/shared/refs";
import { createDataStudio, tableMenu } from "./workspace";

/** Data Studio as a browser tab would have it: the address and what the person keeps, here in memory. */
const open = (location = memoryLocation(), storage = memoryStorage()) => ({
  jali: createDataStudio({
    storage,
    features: [urlSync({ location, sizes: "link" })],
    size: { width: 1440, height: 900 },
    moveFocus: false,
  }),
  location,
  storage,
});

describe("Data Studio's workspace", () => {
  it("brings back the layout and a query's draft after a reload", () => {
    const first = open();
    // Started, as <JaliRoot> starts it: it saves what the person keeps from then on.
    first.jali.start();
    first.jali.actions.preset("query-chart");
    // What the query's editor keeps as the person types (panes/kinds/query.tsx): its draft, in pane state.
    reportPaneState(first.jali, "query", "sql", "SELECT count(*) FROM orders");
    first.jali.destroy();

    // The same address and the same storage: a reload.
    const { jali } = open(first.location, first.storage);
    expect(jali.get().presetId).toBe("query-chart");
    expect(paneStateOf(jali, "query")?.sql).toBe("SELECT count(*) FROM orders");
  });

  it("starts from its preset when this browser keeps nothing", () => {
    const { jali } = open();
    expect(paneStateOf(jali, "query")).toBeUndefined();
    expect(jali.model().panes.map((p) => p.ref.kind)).not.toContain("query");
  });

  it("offers a table's structure and a query of it from its tab's menu, beside it", () => {
    const { jali } = open();
    jali.actions.preset("one-table");
    const menu = tableMenu(() => jali)({ id: "orders", ref: tableRef("orders") }) ?? [];
    expect(menu.map((i) => i.title)).toEqual(["Show its structure", "Query this table"]);
    menu[0]!.run({ id: "orders", ref: tableRef("orders") });
    menu[1]!.run({ id: "orders", ref: tableRef("orders") });
    const opened = jali.model().panes.map((p) => p.ref);
    expect(opened).toContainEqual({ kind: "structure", params: { table: "orders" } });
    expect(opened).toContainEqual({
      kind: "query",
      params: { sql: "SELECT *\nFROM orders\nLIMIT 100" },
    });
    // Other kinds keep Jali's items only.
    expect(tableMenu(() => jali)({ id: "catalog", ref: { kind: "catalog", params: {} } })).toBe(
      undefined,
    );
  });

  it("says what a query loses in its own words, and keeps Jali's English for the rest", () => {
    const { jali } = open();
    expect(jali.messages.confirmDiscard.body(1)).toBe(
      "This query has an edit that hasn't run. It will be lost.",
    );
    expect(jali.messages.confirmDiscard.title).toBe(en.confirmDiscard.title);
    expect(jali.messages.confirmDiscard.discard).toBe(en.confirmDiscard.discard);
  });
});
