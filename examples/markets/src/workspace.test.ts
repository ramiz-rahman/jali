import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { listCommands, type DeepReadonly, type Jali, type LayoutNode } from "jali";
import { chooserRequest, reportUnsaved, testJaliOptions } from "jali/testing";
import { openFollowing, show } from "./actions";
import { createSimulator } from "./market/simulator";
import { chart } from "./panes/chart";
import { quote } from "./panes/quote";
import { createServices } from "./services";
import type { Question } from "./shell/Question";
import { createMarketsJali, kinds } from "./workspace";

/** The app's workspace with nothing shared: a memory address and storage, a fixed size, no DOM focus. `ask` answers
 *  the app's question before unsent work is lost (main.tsx: its dialog). */
function testJali({
  search = "",
  width = 1440,
  height = 900,
  ask,
}: { search?: string; width?: number; height?: number; ask?: (q: Question) => boolean } = {}) {
  const market = createSimulator({ seed: 3, start: new Date(2026, 10, 19, 11, 45).getTime() });
  const services = createServices(market, { persist: false });
  const { options, location } = testJaliOptions({ search, size: { width, height } });
  const jali = createMarketsJali(services, { ...options, ask });
  return { jali, location, services };
}

/** What the chooser was asked (the engine's state: what Jali's chooser dialog renders). */
const chooser = (jali: Jali) => {
  const request = chooserRequest(jali);
  if (!request) throw new Error("the chooser is not asking");
  return request;
};
/** Choose the item labelled `label`, as the person would in the chooser titled `title`. */
const choose = (jali: Jali, label: string, title: string) => {
  const request = chooser(jali);
  expect(request.title).toBe(title);
  request.onChoose(request.items.find((i) => request.label(i) === label));
};

/** The tabs of the tab group holding pane `id`, in the layout. */
const tabsOf = (node: DeepReadonly<LayoutNode>, id: string): string[] | undefined =>
  node.type === "pane"
    ? undefined
    : node.type === "stack" && node.children.some((c) => c.id === id)
      ? node.children.map((c) => c.id)
      : node.children.reduce<string[] | undefined>((found, c) => found ?? tabsOf(c, id), undefined);

/** The panes folded for room, in tree order. */
const folded = (jali: Jali) =>
  jali
    .model()
    .panes.filter((p) => p.where === "folded")
    .map((p) => p.id);
const ids = (jali: Jali) => jali.model().panes.map((p) => p.id);
const shown = (jali: Jali, id: string) => jali.model().pane(id)?.ref.params.symbol;

describe("the markets workspace", () => {
  afterEach(() => vi.useRealTimers());

  it("opens on the Equities desk: a watchlist and the details that follow it", () => {
    const { jali } = testJali();
    expect(jali.get().presetId).toBe("equities");
    expect(ids(jali)).toEqual(["watch", "chart", "book", "tape", "quote", "news"]);
    for (const id of ["chart", "book", "tape", "quote", "news"]) {
      expect(jali.model().pane(id)).toMatchObject({ linkedTo: "watch", follows: true });
    }
  });

  it("gives every kind a minimum width, so a crowded desk folds instead of squeezing", () => {
    for (const k of kinds) expect(k.width?.min, k.kind).toBeGreaterThanOrEqual(220);
    expect(folded(testJali({ width: 1440 }).jali)).toEqual([]);
    expect(folded(testJali({ width: 900 }).jali).length).toBeGreaterThan(0);
  });

  it("switches desks", () => {
    const { jali } = testJali();
    jali.actions.preset("rates");
    expect(ids(jali)).toContain("curve");
    expect(jali.model().pane("watch")?.ref.params.list).toBe("rates");
    jali.actions.preset("fx");
    expect(shown(jali, "chart")).toBe("EURUSD");
  });

  it("keeps the desk in the address: a link opens the same layout", () => {
    const { jali, location } = testJali();
    jali.actions.preset("compare");
    const link = location.search();
    expect(new URLSearchParams(link).get("l")).toBeTruthy();

    expect(new URLSearchParams(link).get("preset")).toBe("compare");

    const { jali: reader } = testJali({ search: link });
    expect(ids(reader)).toEqual(ids(jali));
    // The link names its desk: the top bar marks Compare, and Reset rebuilds it.
    expect(reader.get().presetId).toBe("compare");
    expect(reader.model().pane("chart-a")).toMatchObject({
      kept: true,
      ref: chart({ symbol: "LMNA" }),
    });
  });

  it("moves every follower when the watchlist selects, once the selection rests", () => {
    vi.useFakeTimers();
    const { jali } = testJali();
    jali.actions.select("watch", quote({ symbol: "ORBD" }));
    expect(shown(jali, "quote")).toBe("LMNA");
    vi.advanceTimersByTime(200);
    expect(shown(jali, "quote")).toBe("ORBD");
    // The chart, book, trades and news show the same instrument, in the same change (their kinds' `follow`).
    for (const id of ["chart", "book", "tape", "news"]) expect(shown(jali, id)).toBe("ORBD");
  });

  it("compares: a kept quote keeps its instrument while the following one moves", () => {
    vi.useFakeTimers();
    const { jali } = testJali();
    jali.actions.preset("compare");
    jali.actions.select("watch", quote({ symbol: "HRBK" }));
    vi.advanceTimersByTime(200);
    expect(shown(jali, "quote")).toBe("HRBK");
    expect(shown(jali, "quote-a")).toBe("LMNA");
  });

  it("asks before a desk change loses an unsent order, naming it, and keeps it on No", () => {
    const asked: Question[] = [];
    let discard = false;
    const { jali } = testJali({ ask: (q) => (asked.push(q), discard) });
    jali.actions.preset("fx");
    // What the blotter's `useUnsaved` reports: the engine's step, as React calls it.
    reportUnsaved(jali, "blotter", "an unsent order to buy 100 LMNA");
    expect(jali.actions.preset("rates")).toMatchObject({ ok: false });
    expect(asked).toEqual([
      {
        title: "Discard the unsent order?",
        body: "This change takes the blotter away, and with it an unsent order to buy 100 LMNA.",
        keep: "Keep the order",
        discard: "Discard",
      },
    ]);
    expect(jali.get().presetId).toBe("fx");
    discard = true;
    expect(jali.actions.preset("rates")).toMatchObject({ ok: true });
    expect(jali.get().presetId).toBe("rates");
    // Nothing unsent: a desk change doesn't ask.
    jali.actions.preset("fx");
    expect(asked).toHaveLength(2);
  });

  it("has room to compare at 1440: keep the chart, open another, and nothing folds", () => {
    const { jali } = testJali({ width: 1424, height: 820 });
    jali.actions.setKept("chart", true);
    jali.actions.select("watch", quote({ symbol: "ORBD" }));
    const opened = openFollowing(jali, "watch", chart({ symbol: "ORBD" }))!;
    expect(jali.model().pane(opened)).toMatchObject({
      follows: true,
      ref: chart({ symbol: "ORBD" }),
    });
    expect(jali.model().pane("chart")).toMatchObject({
      kept: true,
      ref: chart({ symbol: "LMNA" }),
    });
    expect(folded(jali)).toEqual([]);
  });

  it("lists the app's own commands in ⌘K, with their keys", () => {
    const { jali } = testJali();
    const listed = listCommands(jali);
    const chartFor = listed.find((c) => c.id === "markets.chart");
    expect(chartFor?.title).toBe("Open chart for…");
    expect(chartFor?.keys).toBeTruthy();
    expect(listed.some((c) => c.title === "Layout: Rates desk")).toBe(true);
  });

  it("asks for an instrument in Jali's chooser, and shows the chosen chart", () => {
    const { jali } = testJali();
    listCommands(jali)
      .find((c) => c.id === "markets.chart")!
      .run();
    choose(jali, "GOV5Y", "Open chart for…");
    expect(
      jali.model().panes.some((p) => p.ref.kind === "chart" && p.ref.params.symbol === "GOV5Y"),
    ).toBe(true);
  });

  it("asks only for instruments that trade, to buy", () => {
    const { jali } = testJali();
    listCommands(jali)
      .find((c) => c.id === "markets.buy")!
      .run();
    const request = chooser(jali);
    expect(request.items.map(request.label)).not.toContain("MX40");
    expect(request.items.map(request.label)).toContain("LMNA");
  });

  it("opens a second chart as a tab of the chart, in one step", () => {
    const { jali, location } = testJali();
    const entries = location.entries.length;
    const panes = ids(jali);
    const opened = show(jali, chart({ symbol: "ORBD" }))!;
    // A tab of the chart: shown in front of it, in the chart's tab group.
    expect(jali.model().pane(opened)?.where).toBe("shown");
    expect(jali.model().pane("chart")?.where).toBe("tab");
    expect(tabsOf(jali.getLayout().root, opened)).toEqual(["chart", opened]);
    expect(location.entries.length).toBe(entries + 1);
    expect(folded(jali)).toEqual([]);
    expect(ids(jali).filter((id) => id !== opened)).toEqual(panes);
    expect(jali.get().view.focused).toBe(opened);
    // Already open: shown, not opened twice.
    expect(show(jali, chart({ symbol: "ORBD" }))).toBe(opened);
    expect(ids(jali)).toHaveLength(panes.length + 1);
  });

  it("adds to the watchlist on screen", () => {
    const { jali, services } = testJali();
    listCommands(jali)
      .find((c) => c.id === "markets.watch")!
      .run();
    choose(jali, "EURUSD", "Add to Equities…");
    expect(services.lists.get().find((l) => l.id === "equities")?.symbols).toContain("EURUSD");
  });
});
