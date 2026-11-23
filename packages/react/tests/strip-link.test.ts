/**
 * A row that scrolls sideways keeps its place in the link (`scroll=week:732`), so a reload or a shared link reopens
 * where the person was. Scrolling replaces the history entry: Back doesn't step through every swipe.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row, type Jali } from "@jali/core";
import { definePane } from "@jali/react";
import { storeOf } from "../../core/src/state/instance";
import { readSearch, REPLACE_MS } from "../../core/src/url";
import { defaultFeatures, urlSync } from "./features";

const day = definePane("day", {
  params: { n: Number },
  title: ({ n }) => `Day ${n}`,
  width: { min: 300, comfortable: 360 },
  Component: () => null,
});
const layout = row(
  { id: "outer" },
  row(
    { id: "week", scroll: "x" },
    ...[1, 2, 3, 4, 5, 6, 7].map((n) => pane(day({ n }), { id: `d${n}` })),
  ),
);
const make = (location = memoryLocation()): Jali =>
  createJali({
    panes: [day],
    layout,
    features: [...defaultFeatures(), urlSync({ location })],
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });
const scrollParam = (search: string) => new URLSearchParams(search).get("scroll");

describe("a strip's place in the link", () => {
  it("goes into the link, and a link reopens there", async () => {
    const location = memoryLocation();
    const jali = make(location);
    storeOf(jali).actions.setScroll("week", 732);
    // A replace is written at most every 250 ms.
    await new Promise((r) => setTimeout(r, REPLACE_MS + 10));
    expect(scrollParam(location.search())).toBe("week:732");

    const reader = make(memoryLocation(location.search()));
    expect(reader.get().view.scroll).toEqual({ week: 732 });
  });

  it("replaces the history entry, so Back doesn't step through every swipe", () => {
    const location = memoryLocation();
    const jali = make(location);
    const before = location.entries.length;
    storeOf(jali).actions.setScroll("week", 300);
    storeOf(jali).actions.setScroll("week", 600);
    expect(location.entries.length).toBe(before);
  });

  it("a strip at its start writes nothing", () => {
    const location = memoryLocation();
    const jali = make(location);
    storeOf(jali).actions.setScroll("week", 400);
    storeOf(jali).actions.setScroll("week", 0);
    expect(scrollParam(location.search())).toBeNull();
  });

  it("a link's offset for a row that isn't there, or isn't a number, is left out", () => {
    const jali = make();
    const code = new URLSearchParams(jali.href().split("?")[1]).get("l")!;
    const read = readSearch(
      `?l=${code}&scroll=week:abc,nowhere:300,week:-5`,
      jali.env.kinds.registry(),
    );
    expect(read && "layout" in read ? read.view.scroll : "unread").toBeUndefined();
    const good = readSearch(`?l=${code}&scroll=week:250.6`, jali.env.kinds.registry());
    expect(good && "layout" in good ? good.view.scroll : "unread").toEqual({ week: 251 });
  });
});
