import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { listCommands, memoryLocation, memoryStorage, type Jali } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { currentPlace, selectPlace, showDay } from "./actions";
import { day } from "./panes/day";
import { place } from "./panes/place";
import { createServices } from "./services";
import { DEFAULT_PLAN, dayOf } from "./trip/plan";
import { createTripsJali, kinds } from "./workspace";

/** The app's workspace with nothing shared: a memory address and storage, a fixed size, no DOM focus. */
function testJali({ search = "", width = 1440, height = 900 } = {}) {
  const notes: string[] = [];
  const services = createServices({ persist: false, notify: (t) => notes.push(t) });
  const location = memoryLocation(search);
  const jali = createTripsJali(services, {
    url: { location },
    storage: memoryStorage(),
    size: { width, height },
    moveFocus: false,
    keymapOptions: { platform: "mac" },
  });
  return { jali, location, services, notes };
}

/** What the chooser was asked (the engine's state: what Jali's chooser dialog renders). */
const chooser = (jali: Jali) => {
  const c = storeOf(jali).get().chooser;
  if (c?.kind !== "choose") throw new Error("the chooser is not asking");
  return c.request;
};
const choose = (jali: Jali, label: string | RegExp, title: string) => {
  const request = chooser(jali);
  expect(request.title).toBe(title);
  const item = request.items.find((i) =>
    typeof label === "string" ? request.label(i) === label : label.test(request.label(i)),
  );
  if (!item) throw new Error(`no choice ${label}`);
  request.onChoose(item);
};
const run = (jali: Jali, id: string) =>
  listCommands(jali)
    .find((c) => c.id === id)!
    .run();

const ids = (jali: Jali) => jali.model().panes.map((p) => p.id);
const shows = (jali: Jali, id: string) => jali.model().pane(id)?.ref.params;

describe("the trips workspace", () => {
  afterEach(() => vi.useRealTimers());

  it("opens on Plan: the overview, the map and the day that follow it, and the place that follows the map", () => {
    const { jali } = testJali();
    expect(jali.get().presetId).toBe("plan");
    expect(ids(jali)).toEqual(["overview", "map", "day", "place"]);
    expect(jali.model().pane("map")).toMatchObject({ linkedTo: "overview", follows: true });
    expect(jali.model().pane("day")).toMatchObject({ linkedTo: "overview", follows: true });
    expect(jali.model().pane("place")).toMatchObject({ linkedTo: "map", follows: true });
    expect(jali.model().folded).toEqual([]);
  });

  it("gives the map honest widths: it wants the room, and the others fold before it squeezes", () => {
    const mapKind = kinds.find((k) => k.kind === "map")!;
    expect(mapKind.width).toMatchObject({ min: 360, comfortable: 640 });
    for (const k of kinds) expect(k.width?.min, k.kind).toBeGreaterThanOrEqual(260);
    // At 1440 the four Plan panes fit; at 1024 the place folds behind the map it follows.
    expect(testJali({ width: 1024 }).jali.model().folded).toEqual(["place"]);
  });

  it("moves the day plan and the map together when the overview selects a day", () => {
    vi.useFakeTimers();
    const { jali } = testJali();
    jali.actions.select("overview", day({ n: 3 }));
    vi.advanceTimersByTime(200);
    expect(shows(jali, "day")).toEqual({ n: 3 });
    // The map is another kind: its `follow` turns a day into { day }.
    expect(shows(jali, "map")).toEqual({ day: 3 });
  });

  it("selects a place everywhere: the list, the map, and the place pane that follows the map", () => {
    vi.useFakeTimers();
    const { jali } = testJali();
    selectPlace(jali, "se", { from: "day" });
    expect(jali.get().selection.day?.ref).toEqual(place({ id: "se" }));
    expect(currentPlace(jali)).toBe("se");
    vi.advanceTimersByTime(200);
    expect(shows(jali, "place")).toEqual({ id: "se" });
  });

  it("compares two places: keep one, select another, and a second place pane opens beside it", () => {
    vi.useFakeTimers();
    const { jali } = testJali();
    jali.actions.setKept("place", true);
    const opened = selectPlace(jali, "h-alfama");
    expect(opened).toBeTruthy();
    expect(jali.model().pane(opened)).toMatchObject({
      linkedTo: "map",
      follows: true,
      ref: place({ id: "h-alfama" }),
    });
    expect(jali.model().pane("place")).toMatchObject({ kept: true, ref: place({ id: "castelo" }) });
    // The next one goes to the following pane; the kept one stays.
    selectPlace(jali, "h-graca");
    vi.advanceTimersByTime(200);
    expect(shows(jali, opened!)).toEqual({ id: "h-graca" });
    expect(shows(jali, "place")).toEqual({ id: "castelo" });
  });

  it("opens Stay already comparing: one hotel kept, the other following the map", () => {
    const { jali } = testJali();
    jali.actions.preset("stay");
    expect(jali.model().pane("place-kept")).toMatchObject({ kept: true, linkedTo: "map" });
    expect(jali.model().pane("place")).toMatchObject({ follows: true, linkedTo: "map" });
    expect(jali.model().pane("explore")?.ref.params).toEqual({ category: "stay" });
  });

  it("lays the days side by side, folding the ones that don't fit and bringing them back with room", () => {
    const narrow = testJali({ width: 1440 }).jali;
    narrow.actions.preset("days");
    const folded = narrow.model().folded;
    expect(folded.length).toBeGreaterThan(0);
    expect(folded.every((id) => id.startsWith("day-"))).toBe(true);
    // A wider screen has room for every day and the map.
    const wide = testJali({ width: 2400 }).jali;
    wide.actions.preset("days");
    expect(wide.model().folded).toEqual([]);
    expect(wide.model().visible).toEqual(expect.arrayContaining(["day-1", "day-5", "map"]));
  });

  it("keeps the layout, the day and the place in the address: a link reopens them", () => {
    vi.useFakeTimers();
    const { jali, location } = testJali();
    jali.actions.select("overview", day({ n: 4 }));
    selectPlace(jali, "azulejo", { from: "day" });
    vi.advanceTimersByTime(200);
    const link = location.search();
    expect(new URLSearchParams(link).get("l")).toBeTruthy();

    const { jali: reader } = testJali({ search: link });
    expect(ids(reader)).toEqual(ids(jali));
    expect(shows(reader, "day")).toEqual({ n: 4 });
    expect(shows(reader, "map")).toEqual({ day: 4 });
    expect(shows(reader, "place")).toEqual({ id: "azulejo" });
  });

  it("names its preset in the link", () => {
    const { jali, location } = testJali();
    jali.actions.preset("budget");
    expect(new URLSearchParams(location.search()).get("preset")).toBe("budget");
    const { jali: reader } = testJali({ search: location.search() });
    expect(reader.get().presetId).toBe("budget");
    expect(ids(reader)).toContain("budget");
  });

  it("keeps the shared panes mounted across a preset switch where they are the same object", () => {
    const { jali } = testJali();
    jali.actions.preset("budget");
    // The overview is the same pane (same id, same object); the day differs (Day 5), so it starts afresh.
    expect(jali.model().pane("overview")?.ref.kind).toBe("trip");
    expect(shows(jali, "day")).toEqual({ n: 5 });
  });

  it("lists the app's commands in ⌘K, with their keys", () => {
    const { jali } = testJali();
    const listed = listCommands(jali);
    for (const id of ["trips.go", "trips.add", "trips.optimise", "trips.undo", "trips.reset"])
      expect(listed.some((c) => c.id === id), id).toBe(true);
    expect(listed.find((c) => c.id === "trips.go")?.keys).toBe("⌘K ⌘P");
    expect(listed.some((c) => c.title === "Layout: Days")).toBe(true);
  });

  it("goes to a place from ⌘K", () => {
    vi.useFakeTimers();
    const { jali } = testJali();
    run(jali, "trips.go");
    choose(jali, "Oceanário de Lisboa", "Go to place…");
    vi.advanceTimersByTime(200);
    expect(currentPlace(jali)).toBe("oceanario");
    expect(shows(jali, "place")).toEqual({ id: "oceanario" });
  });

  it("adds a place to a day from ⌘K: a place, then a day", () => {
    const { jali, services, notes } = testJali();
    run(jali, "trips.add");
    choose(jali, "MAAT", "Add to day…");
    // MAAT is on Day 2 already, so it moves.
    choose(jali, /^Day 4/, "Add MAAT to…");
    expect(dayOf(services.plan.get(), 4)!.stops.at(-1)).toBe("maat");
    expect(dayOf(services.plan.get(), 2)!.stops).not.toContain("maat");
    expect(notes.at(-1)).toBe("Moved MAAT to Day 4");
  });

  it("optimises a day from ⌘K, says what it saved, and undoes it", () => {
    const { jali, services, notes } = testJali();
    run(jali, "trips.optimise");
    choose(jali, /^Day 1/, "Optimise day…");
    expect(dayOf(services.plan.get(), 1)!.stops).not.toEqual(DEFAULT_PLAN.days[0]!.stops);
    expect(notes.at(-1)).toMatch(/^Day 1: \d+ min less travel/);
    run(jali, "trips.undo");
    expect(services.plan.get()).toEqual(DEFAULT_PLAN);
  });

  it("asks only for hotels, to stay", () => {
    const { jali } = testJali();
    run(jali, "trips.stay");
    const request = chooser(jali);
    expect(request.items.map(request.label)).toContain("Pátio das Gaivotas");
    expect(request.items.map(request.label)).not.toContain("Castelo de São Jorge");
  });

  it("shows a day: the pane that has it, else the overview's following day", () => {
    const { jali } = testJali();
    showDay(jali, 2);
    expect(shows(jali, "day")).toEqual({ n: 2 });
    expect(jali.get().view.focused).toBe("day");
    jali.actions.preset("days");
    expect(showDay(jali, 5)).toBe("day-5");
  });
});
