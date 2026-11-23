import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Jali } from "jali";
import { createTestJali, reportUnsaved, type TestLocation } from "jali/testing";
import { orderKind, orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";

/** An instance with nothing shared: its own address, its own storage, a fixed size, no DOM focus. */
const testJali = (search = "", size = { width: 1440, height: 900 }) =>
  createTestJali({ panes: orderKinds, presets, preset: "triage", search, size });

const ids = (jali: Jali) => jali.model().panes.map((p) => p.id);

describe("the orders app", () => {
  let jali: Jali;
  let location: TestLocation;
  beforeEach(() => ({ jali, location } = testJali()));
  afterEach(() => vi.useRealTimers());

  it("opens an order beside the list and keeps focus in the list", () => {
    const opened = jali.actions.openBeside("orders", orderKind({ id: 3 }));
    expect(opened.ok).toBe(true);
    expect(jali.model().pane(opened.pane)?.ref.params.id).toBe(3);
    expect(jali.get().view.focused).toBe("orders");
  });

  it("says why a close did not happen", () => {
    expect(jali.actions.close("invoices")).toEqual({ ok: false, reason: "not-found" });
    // What useUnsaved reports from a rendered pane, reported by hand.
    reportUnsaved(jali, "order", "an unsaved note");
    expect(jali.actions.close("order")).toMatchObject({ ok: false, reason: "unsaved" });
    expect(ids(jali)).toContain("order");
  });

  it("tells the app what opened and closed", () => {
    const closed: string[] = [];
    jali.on("close", ({ pane }) => closed.push(pane));
    jali.actions.close("order");
    expect(closed).toEqual(["order"]);
  });

  it("writes the layout to its own address, and a new history entry for a deliberate change", () => {
    jali.actions.preset("customer-desk");
    const q = new URLSearchParams(location.search());
    expect(q.get("l")).toBeTruthy();
    expect(location.entries.length).toBe(2);
  });

  it("opens a link: the layout in the address wins over the preset", () => {
    jali.actions.preset("customer-desk");
    const link = location.search();

    const { jali: reader } = testJali(link);
    expect(ids(reader)).toEqual(ids(jali));
  });

  it("shows the selected order in the following detail once the cursor rests", () => {
    vi.useFakeTimers();
    jali.actions.select("orders", orderKind({ id: 5 }));
    vi.advanceTimersByTime(200);
    expect(jali.model().pane("order")?.ref.params.id).toBe(5);
  });

  it("folds what does not fit", () => {
    // orders 440 + order 360 do not fit in 700
    const { jali: narrow } = testJali("", { width: 700, height: 900 });
    expect(narrow.model().panes.some((p) => p.where === "folded")).toBe(true);
  });
});
