/**
 * A layout switch (a preset, `setLayout`) and a list that keeps its selection agree (examples/studio/FINDINGS.md #4).
 * The layout's word wins: a follower it gives of the selected kind resets the list's selection to what it shows. With
 * no follower of that kind, the followers follow the list's selection.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { definePane } from "@jali/react";
import { FOLLOW_MS } from "../packages/core/src/actions/follow";

const Nothing = () => null;
const watchlist = definePane("watchlist", { title: "Watchlist", Component: Nothing });
const quote = definePane("quote", {
  params: { symbol: String },
  title: ({ symbol }) => `${symbol} quote`,
  width: { min: 240 },
  Component: Nothing,
});
const chart = definePane("chart", {
  params: { symbol: String },
  title: ({ symbol }) => `${symbol} chart`,
  width: { min: 240 },
  follow: (selected) => ({ symbol: selected.params.symbol }),
  Component: Nothing,
});

const follows = { linkedTo: "watch", follows: true } as const;
const watch = () => pane(watchlist(), { id: "watch" });
const make = () =>
  createJali({
    panes: [watchlist, quote, chart],
    presets: [
      {
        id: "quotes",
        label: "Quotes",
        layout: row(watch(), pane(quote({ symbol: "LMNA" }), { id: "quote", ...follows })),
      },
      {
        id: "charts",
        label: "Charts",
        layout: row(watch(), pane(chart({ symbol: "LMNA" }), { id: "chart", ...follows })),
      },
      {
        id: "both",
        label: "Both",
        layout: row(
          watch(),
          pane(quote({ symbol: "KSTR" }), { id: "quote", ...follows }),
          pane(chart({ symbol: "LMNA" }), { id: "chart", ...follows }),
        ),
      },
    ],
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1600, height: 900 },
    moveFocus: false,
  });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const shown = (jali: ReturnType<typeof make>, id: string) => jali.model().pane(id)?.ref;
const selected = (jali: ReturnType<typeof make>) => jali.get().selection.watch?.ref;

describe("a layout switch beside a list with a selection", () => {
  it("resets the selection to the follower the layout gives, and the other followers show it too", () => {
    const jali = make();
    jali.actions.preset("quotes");
    jali.actions.select("watch", quote({ symbol: "ORBD" }));
    vi.advanceTimersByTime(FOLLOW_MS);
    expect(shown(jali, "quote")).toEqual(quote({ symbol: "ORBD" }));
    const layouts: unknown[] = [];
    jali.on("layout", (e) => layouts.push(e.layout));
    expect(jali.actions.preset("both")).toMatchObject({ ok: true });
    expect(selected(jali)).toEqual(quote({ symbol: "KSTR" }));
    expect(shown(jali, "quote")).toEqual(quote({ symbol: "KSTR" }));
    expect(shown(jali, "chart")).toEqual(chart({ symbol: "KSTR" }));
    // One change: no follow step after it.
    vi.advanceTimersByTime(FOLLOW_MS);
    expect(layouts).toHaveLength(1);
  });

  it("makes the followers follow the selection when the layout gives none of the selected kind", () => {
    const jali = make();
    jali.actions.preset("quotes");
    jali.actions.select("watch", quote({ symbol: "ORBD" }));
    vi.advanceTimersByTime(FOLLOW_MS);
    jali.actions.preset("charts");
    expect(selected(jali)).toEqual(quote({ symbol: "ORBD" }));
    expect(shown(jali, "chart")).toEqual(chart({ symbol: "ORBD" }));
  });

  it("does the same for setLayout", () => {
    const jali = make();
    jali.actions.preset("quotes");
    jali.actions.select("watch", quote({ symbol: "ORBD" }));
    vi.advanceTimersByTime(FOLLOW_MS);
    jali.setLayout(row(watch(), pane(quote({ symbol: "HRBK" }), { id: "quote", ...follows })));
    expect(selected(jali)).toEqual(quote({ symbol: "HRBK" }));
    jali.setLayout(row(watch(), pane(chart({ symbol: "LMNA" }), { id: "chart", ...follows })));
    expect(shown(jali, "chart")).toEqual(chart({ symbol: "HRBK" }));
  });

  it("leaves a kept detail and a follower with unsaved work as the layout gives them", () => {
    const jali = make();
    jali.actions.preset("quotes");
    jali.actions.select("watch", quote({ symbol: "ORBD" }));
    vi.advanceTimersByTime(FOLLOW_MS);
    jali.setLayout(
      row(
        watch(),
        pane(chart({ symbol: "LMNA" }), { id: "kept", linkedTo: "watch", kept: true }),
        pane(chart({ symbol: "LMNA" }), { id: "chart", ...follows }),
      ),
    );
    expect(shown(jali, "kept")).toEqual(chart({ symbol: "LMNA" }));
    expect(shown(jali, "chart")).toEqual(chart({ symbol: "ORBD" }));
    storeOf(jali).actions.setUnsaved("chart", "an unsaved drawing");
    jali.setLayout(row(watch(), pane(chart({ symbol: "KSTR" }), { id: "chart", ...follows })));
    // A follower with unsaved work isn't moved to the selection: the layout's object for it asks first, as always.
    expect(storeOf(jali).get().confirm?.panes).toEqual(["chart"]);
  });

  it("changes nothing for a list with no selection", () => {
    const jali = make();
    jali.actions.preset("both");
    expect(selected(jali)).toBeUndefined();
    expect(shown(jali, "quote")).toEqual(quote({ symbol: "KSTR" }));
    expect(shown(jali, "chart")).toEqual(chart({ symbol: "LMNA" }));
  });
});
