import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { listCommands, memoryLocation, memoryStorage, type Jali } from "@jali/core";
import { openFollowing } from "./actions";
import { createSimulator } from "./market/simulator";
import { chart } from "./panes/chart";
import { quote } from "./panes/quote";
import { createServices } from "./services";
import { createMarketsJali, kinds } from "./workspace";

/** The app's workspace with nothing shared: a memory address and storage, a fixed size, no DOM focus. */
function testJali({ search = "", width = 1440, height = 900 } = {}) {
  const market = createSimulator({ seed: 3, start: new Date(2026, 10, 19, 11, 45).getTime() });
  const services = createServices(market, { persist: false });
  const location = memoryLocation(search);
  const jali = createMarketsJali(services, {
    url: { location },
    storage: memoryStorage(),
    size: { width, height },
    moveFocus: false,
  });
  return { jali, location, services };
}

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
    expect(testJali({ width: 1440 }).jali.model().folded).toEqual([]);
    expect(testJali({ width: 900 }).jali.model().folded.length).toBeGreaterThan(0);
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

    const { jali: reader } = testJali({ search: link });
    expect(ids(reader)).toEqual(ids(jali));
    expect(reader.model().pane("chart-a")).toMatchObject({
      pinned: true,
      ref: chart({ symbol: "LMNA" }),
    });
  });

  it("moves the following quote when the watchlist selects, once the selection rests", () => {
    vi.useFakeTimers();
    const { jali } = testJali();
    jali.actions.select("watch", quote({ symbol: "ORBD" }));
    expect(shown(jali, "quote")).toBe("LMNA");
    vi.advanceTimersByTime(200);
    expect(shown(jali, "quote")).toBe("ORBD");
    // The chart, book and news catch up through `follow` (panes/follow.ts does this as the selection changes).
    jali.actions.follow("watch", chart({ symbol: "ORBD" }));
    expect(shown(jali, "chart")).toBe("ORBD");
  });

  it("compares: a pinned quote keeps its instrument while the following one moves", () => {
    vi.useFakeTimers();
    const { jali } = testJali();
    jali.actions.preset("compare");
    jali.actions.select("watch", quote({ symbol: "HRBK" }));
    vi.advanceTimersByTime(200);
    expect(shown(jali, "quote")).toBe("HRBK");
    expect(shown(jali, "quote-a")).toBe("LMNA");
  });

  it("asks before a desk change loses an unsent order", () => {
    const { jali } = testJali();
    jali.actions.preset("fx");
    jali.actions.setUnsaved("blotter", "an unsent order to buy 100 LMNA");
    jali.actions.preset("rates");
    expect(jali.get().confirm?.panes).toEqual(["blotter"]);
    expect(jali.get().presetId).toBe("fx");
    jali.actions.discardAndContinue();
    expect(jali.get().presetId).toBe("rates");
  });

  it("has room to compare at 1440: pin the chart, open another, and nothing folds", () => {
    const { jali } = testJali({ width: 1424, height: 820 });
    jali.actions.setPinned("chart", true);
    jali.actions.select("watch", quote({ symbol: "ORBD" }));
    const opened = openFollowing(jali, "watch", chart({ symbol: "ORBD" }))!;
    expect(jali.model().pane(opened)).toMatchObject({
      follows: true,
      ref: chart({ symbol: "ORBD" }),
    });
    expect(jali.model().pane("chart")).toMatchObject({
      pinned: true,
      ref: chart({ symbol: "LMNA" }),
    });
    expect(jali.model().folded).toEqual([]);
  });

  it("lists the app's own commands in ⌘K, with their keys", () => {
    const { jali } = testJali();
    const listed = listCommands(jali);
    const chartFor = listed.find((c) => c.id === "markets.chart");
    expect(chartFor?.title).toBe("Open chart for…");
    expect(chartFor?.keys).toBeTruthy();
    expect(listed.some((c) => c.title === "Layout: Rates desk")).toBe(true);
  });

  it("opens the picker from a command, and shows the chosen chart", () => {
    const { jali, services } = testJali();
    listCommands(jali)
      .find((c) => c.id === "markets.chart")!
      .run();
    const request = services.picker.get();
    expect(request?.title).toBe("Open chart for…");
    request!.onPick("GOV5Y");
    expect(
      jali.model().panes.some((p) => p.ref.kind === "chart" && p.ref.params.symbol === "GOV5Y"),
    ).toBe(true);
  });

  it("adds to the watchlist on screen", () => {
    const { jali, services } = testJali();
    listCommands(jali)
      .find((c) => c.id === "markets.watch")!
      .run();
    services.picker.get()!.onPick("EURUSD");
    expect(services.lists.get().find((l) => l.id === "equities")?.symbols).toContain("EURUSD");
  });
});
