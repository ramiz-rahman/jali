/**
 * A list's first selection comes from its follower. A list whose kind says what it selects (`selects`) and has no
 * selection starts on what its follower of that kind shows: at start-up, on a link, after a preset or `setLayout`.
 * A follower of another kind gives nothing (what it shows is derived from a selection and can't be turned back).
 * A layout that arrives (Back, a link, a reload) and a list that has a selection agree on the selection's side: the
 * selection becomes what its follower of the selected kind shows, and the followers stay as the layout has them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createJali,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  type PresetOptions,
} from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { definePane } from "@jali/react";
import { FOLLOW_MS } from "../../core/src/actions/follow";
import { REPLACE_MS } from "../../core/src/url";
import { defaultFeatures, urlSync } from "./features";

const Nothing = () => null;
const symbol = { symbol: String };
const watchlist = definePane("watchlist", {
  title: "Watchlist",
  selects: "quote",
  Component: Nothing,
});
// A list that says nothing about what it selects: as before, it starts on nothing.
const plain = definePane("plain", { title: "Plain", Component: Nothing });
const quote = definePane("quote", {
  params: symbol,
  title: ({ symbol }) => `${symbol} quote`,
  Component: Nothing,
});
const chart = definePane("chart", {
  params: symbol,
  title: ({ symbol }) => `${symbol} chart`,
  follow: (selected) => ({ symbol: selected.params.symbol }),
  Component: Nothing,
});
// A chain: days (a list of days) → a map that follows the day and is itself a list of places → a place.
const days = definePane("days", { title: "Days", selects: "day", Component: Nothing });
const day = definePane("day", {
  params: { n: Number },
  title: ({ n }) => `Day ${n}`,
  Component: Nothing,
});
const map = definePane("map", {
  params: { day: Number },
  title: ({ day }) => `Map of day ${day}`,
  selects: "place",
  follow: (selected) => (selected.kind === "day" ? { day: Number(selected.params.n) } : undefined),
  Component: Nothing,
});
const place = definePane("place", {
  params: { id: String },
  title: ({ id }) => id,
  Component: Nothing,
});

const follows = (to: string) => ({ linkedTo: to, follows: true }) as const;
const presets: PresetOptions[] = [
  {
    id: "quotes",
    label: "Quotes",
    layout: row(
      pane(watchlist(), { id: "watch" }),
      pane(chart({ symbol: "LMNA" }), { id: "chart", ...follows("watch") }),
      pane(quote({ symbol: "LMNA" }), { id: "quote", ...follows("watch") }),
    ),
  },
  {
    id: "charts",
    label: "Charts",
    layout: row(
      pane(watchlist(), { id: "watch" }),
      pane(chart({ symbol: "KSTR" }), { id: "chart", ...follows("watch") }),
    ),
  },
  {
    id: "other",
    label: "Other",
    layout: row(
      pane(watchlist(), { id: "watch2" }),
      pane(quote({ symbol: "ORBD" }), { id: "quote", ...follows("watch2") }),
    ),
  },
  {
    id: "plan",
    label: "Plan",
    layout: row(
      pane(days(), { id: "days" }),
      pane(map({ day: 3 }), { id: "map", ...follows("days") }),
      pane(day({ n: 3 }), { id: "day", ...follows("days") }),
      pane(place({ id: "palace" }), { id: "place", ...follows("map") }),
    ),
  },
  {
    id: "plain",
    label: "Plain",
    layout: row(
      pane(plain(), { id: "plain" }),
      pane(quote({ symbol: "LMNA" }), { id: "quote", ...follows("plain") }),
    ),
  },
];
const make = (opts: { preset?: string; search?: string } = {}) => {
  const location = memoryLocation(opts.search ?? "");
  const jali = createJali({
    panes: [watchlist, plain, quote, chart, days, day, map, place],
    presets,
    ...(opts.preset ? { preset: opts.preset } : {}),
    features: [...defaultFeatures(), urlSync({ location })],
    storage: memoryStorage(),
    size: { width: 1800, height: 900 },
    moveFocus: false,
  });
  return { jali, location };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

type Jali = ReturnType<typeof make>["jali"];
const selected = (jali: Jali, list: string) => jali.get().selection[list]?.ref;
const shown = (jali: Jali, id: string) => jali.model().pane(id)?.ref;

describe("a list with no selection starts on what its follower shows", () => {
  it("at start-up, from the follower of the kind it selects, whatever the followers' order", () => {
    const { jali } = make();
    expect(selected(jali, "watch")).toEqual(quote({ symbol: "LMNA" }));
    expect(jali.get().selection.watch?.inResults).toBe(true);
    // No follow step after it.
    const layouts: unknown[] = [];
    jali.on("layout", (e) => layouts.push(e.layout));
    vi.advanceTimersByTime(FOLLOW_MS);
    expect(layouts).toHaveLength(0);
  });

  it("after a preset, in the preset's one change", () => {
    const { jali } = make({ preset: "plain" });
    expect(jali.get().selection).toEqual({});
    const layouts: unknown[] = [];
    jali.on("layout", (e) => layouts.push(e.layout));
    jali.actions.preset("other");
    expect(selected(jali, "watch2")).toEqual(quote({ symbol: "ORBD" }));
    // One change: no follow step after it.
    vi.advanceTimersByTime(FOLLOW_MS);
    expect(layouts).toHaveLength(1);
  });

  it("after setLayout", () => {
    const { jali } = make({ preset: "plain" });
    jali.setLayout(
      row(
        pane(watchlist(), { id: "w" }),
        pane(quote({ symbol: "HRBK" }), { id: "q", ...follows("w") }),
      ),
    );
    expect(selected(jali, "w")).toEqual(quote({ symbol: "HRBK" }));
  });

  it("when a link arrives, on opening and later, and leaves the linked layout as it is", () => {
    const { jali, location } = make({ preset: "plain" });
    jali.actions.preset("quotes");
    const link = location.search();
    const { jali: reader } = make({ preset: "plain", search: link });
    expect(selected(reader, "watch")).toEqual(quote({ symbol: "LMNA" }));

    const { jali: later, location: at } = make({ preset: "plain" });
    const stop = later.start();
    at.visit(link);
    expect(selected(later, "watch")).toEqual(quote({ symbol: "LMNA" }));
    expect(shown(later, "chart")).toEqual(chart({ symbol: "LMNA" }));
    stop();
  });

  it("settles a chain from the top: list → list → detail", () => {
    const { jali } = make({ preset: "plan" });
    expect(selected(jali, "days")).toEqual(day({ n: 3 }));
    expect(selected(jali, "map")).toEqual(place({ id: "palace" }));
    // The first list's start moves the map it is followed by; the map, a list too, starts on its own follower.
    jali.setLayout(
      row(
        pane(days(), { id: "d" }),
        pane(map({ day: 1 }), { id: "m", ...follows("d") }),
        pane(day({ n: 6 }), { id: "dd", ...follows("d") }),
        pane(place({ id: "beach" }), { id: "p", ...follows("m") }),
      ),
    );
    expect(selected(jali, "d")).toEqual(day({ n: 6 }));
    expect(shown(jali, "m")).toEqual(map({ day: 6 }));
    expect(selected(jali, "m")).toEqual(place({ id: "beach" }));
  });

  it("after setLayout, the list's other followers agree with what it starts on", () => {
    const { jali } = make({ preset: "plain" });
    jali.setLayout(
      row(
        pane(days(), { id: "days" }),
        pane(map({ day: 1 }), { id: "map", ...follows("days") }),
        pane(day({ n: 5 }), { id: "day", ...follows("days") }),
      ),
    );
    expect(selected(jali, "days")).toEqual(day({ n: 5 }));
    expect(shown(jali, "map")).toEqual(map({ day: 5 }));
  });

  it("starts on nothing from a follower of another kind", () => {
    const { jali } = make({ preset: "charts" });
    expect(jali.get().selection.watch).toBeUndefined();
    expect(shown(jali, "chart")).toEqual(chart({ symbol: "KSTR" }));
    // A map that follows days says nothing about the day: the days list starts on nothing.
    jali.setLayout(
      row(pane(days(), { id: "days" }), pane(map({ day: 2 }), { id: "map", ...follows("days") })),
    );
    expect(jali.get().selection.days).toBeUndefined();
  });

  it("starts on nothing when the list's kind doesn't say what it selects", () => {
    const { jali } = make({ preset: "plain" });
    expect(jali.get().selection.plain).toBeUndefined();
  });

  it("leaves a list that has a selection to agreement", () => {
    const { jali } = make();
    jali.actions.select("watch", quote({ symbol: "ORBD" }));
    vi.advanceTimersByTime(FOLLOW_MS);
    jali.actions.preset("charts");
    expect(selected(jali, "watch")).toEqual(quote({ symbol: "ORBD" }));
    expect(shown(jali, "chart")).toEqual(chart({ symbol: "ORBD" }));
  });
});

describe("a layout that arrives (Back, a link, a reload) and a list with a selection agree", () => {
  it("Back to an older preset: the selection becomes what its follower of that kind shows", () => {
    const { jali, location } = make({ preset: "plain" });
    const stop = jali.start();
    jali.actions.preset("quotes");
    jali.actions.select("watch", quote({ symbol: "ORBD" }));
    vi.advanceTimersByTime(REPLACE_MS);
    const older = location.search();
    jali.setLayout(
      row(
        pane(watchlist(), { id: "watch" }),
        pane(quote({ symbol: "KSTR" }), { id: "quote", ...follows("watch") }),
      ),
    );
    expect(selected(jali, "watch")).toEqual(quote({ symbol: "KSTR" }));
    const layouts: unknown[] = [];
    jali.on("layout", (e) => layouts.push(e.layout));
    location.visit(older);
    expect(shown(jali, "quote")).toEqual(quote({ symbol: "ORBD" }));
    expect(shown(jali, "chart")).toEqual(chart({ symbol: "ORBD" }));
    expect(selected(jali, "watch")).toEqual(quote({ symbol: "ORBD" }));
    // Only Back's own announcement, and no follow step after it.
    expect(storeOf(jali).get().announcement.text).toBe("Layout changed by browser history");
    vi.advanceTimersByTime(FOLLOW_MS);
    expect(layouts).toHaveLength(1);
    stop();
  });

  it("a link mid-session: the selection takes the link's quote, and the followers stay as the link has them", () => {
    const { jali: writer, location: from } = make();
    writer.actions.select("watch", quote({ symbol: "ORBD" }));
    vi.advanceTimersByTime(REPLACE_MS);
    const link = from.search();
    const { jali, location } = make();
    const stop = jali.start();
    jali.actions.select("watch", quote({ symbol: "KSTR" }));
    vi.advanceTimersByTime(FOLLOW_MS);
    location.visit(link);
    expect(selected(jali, "watch")).toEqual(quote({ symbol: "ORBD" }));
    expect(shown(jali, "chart")).toEqual(chart({ symbol: "ORBD" }));
    stop();
  });

  it("a follower of an unrelated kind changes nothing", () => {
    const { jali: writer, location: from } = make({ preset: "charts" });
    const link = from.search();
    expect(writer.get().selection.watch).toBeUndefined();
    const { jali, location } = make();
    const stop = jali.start();
    jali.actions.select("watch", quote({ symbol: "HRBK" }));
    vi.advanceTimersByTime(FOLLOW_MS);
    location.visit(link);
    // A chart says nothing about the quote: the selection stays, and the chart stays as the link has it.
    expect(shown(jali, "chart")).toEqual(chart({ symbol: "KSTR" }));
    expect(selected(jali, "watch")).toEqual(quote({ symbol: "HRBK" }));
    stop();
  });

  it("a kept detail of the selected kind doesn't drive it", () => {
    const { jali, location } = make();
    const stop = jali.start();
    jali.actions.select("watch", quote({ symbol: "KSTR" }));
    vi.advanceTimersByTime(FOLLOW_MS);
    const { jali: writer, location: from } = make({ preset: "plain" });
    writer.setLayout(
      row(
        pane(watchlist(), { id: "watch" }),
        pane(quote({ symbol: "ORBD" }), { id: "kept", linkedTo: "watch", kept: true }),
      ),
    );
    location.visit(from.search());
    expect(shown(jali, "kept")).toEqual(quote({ symbol: "ORBD" }));
    expect(selected(jali, "watch")).toEqual(quote({ symbol: "KSTR" }));
    stop();
  });

  it("a reload starts the list on what its follower shows", () => {
    const { jali, location } = make();
    jali.actions.select("watch", quote({ symbol: "HRBK" }));
    vi.advanceTimersByTime(REPLACE_MS);
    const { jali: reloaded } = make({ preset: "plain", search: location.search() });
    expect(shown(reloaded, "quote")).toEqual(quote({ symbol: "HRBK" }));
    expect(selected(reloaded, "watch")).toEqual(quote({ symbol: "HRBK" }));
  });
});
