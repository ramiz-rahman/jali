/**
 * A stop drag changes the drag store on every pointer move. The day panes and the overview read it through narrow
 * hooks, so a move renders only what it changes: these count renders the way the panes read the store.
 */
import { act, render } from "@testing-library/react";
import { Profiler } from "react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { dragStore, useDraggedFrom, useDropDay, useDropIndex, type Drop } from "./drag";

/** What a day pane reads of a drag (panes/day.tsx), counted. */
function Day({ n, length }: { n: number; length: number }) {
  const dragged = useDraggedFrom(n);
  const drop = useDropIndex(n, length);
  return <p data-day={n}>{`${dragged ?? "-"} ${drop}`}</p>;
}

/** What the overview reads (panes/trip/trip.tsx), counted. */
function Overview() {
  return <p>{useDropDay() ?? "-"}</p>;
}

function renderWeek() {
  const renders = new Map<string, number>();
  const counted = (id: string) => () => renders.set(id, (renders.get(id) ?? 0) + 1);
  render(
    <>
      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
        <Profiler key={n} id={`day-${n}`} onRender={counted(`day-${n}`)}>
          <Day n={n} length={7} />
        </Profiler>
      ))}
      <Profiler id="overview" onRender={counted("overview")}>
        <Overview />
      </Profiler>
    </>,
  );
  renders.clear();
  return renders;
}

/** A pointer move over `over`, the way startStopDrag records one (a new object each time). */
const move = (x: number, over: Drop | null) =>
  act(() =>
    dragStore.set({ id: "wat-pho", fromDay: 1, fromIndex: 3, label: "Wat Pho", x, y: 100, over }),
  );

describe("dragging a stop renders only what it changes", () => {
  afterEach(() => act(() => dragStore.set(null)));

  it("60 moves within one place render nothing after the first", () => {
    const renders = renderWeek();
    move(0, { day: 1, index: 2 });
    // Picked up from Day 1 and over it: Day 1 shows both; nothing else is touched.
    expect(Object.fromEntries(renders)).toEqual({ "day-1": 1 });
    for (let x = 1; x <= 60; x++) move(x, { day: 1, index: 2 });
    expect(Object.fromEntries(renders)).toEqual({ "day-1": 1 });
  });

  it("moving on to another day renders the two days and the overview, once each", () => {
    const renders = renderWeek();
    move(0, { day: 1, index: 2 });
    renders.clear();
    for (let x = 1; x <= 30; x++) move(x, { day: 2, index: 0 });
    // Day 1 loses its drop line (it keeps the stop in hand), Day 2 gains one, the overview marks Day 2.
    expect(Object.fromEntries(renders)).toEqual({ "day-1": 1, "day-2": 1, overview: 1 });
    renders.clear();
    for (let x = 31; x <= 60; x++) move(x, { day: 2, index: x < 45 ? 0 : 1 });
    // The drop line moves down a row in Day 2: one render, there alone.
    expect(Object.fromEntries(renders)).toEqual({ "day-2": 1 });
  });

  it("a move over nothing renders nothing more", () => {
    const renders = renderWeek();
    move(0, null);
    renders.clear();
    for (let x = 1; x <= 60; x++) move(x, null);
    expect(renders.size).toBe(0);
  });
});
