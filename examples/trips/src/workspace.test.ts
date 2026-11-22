import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { listCommands, type Jali } from "jali";
import { chooserRequest, testJaliOptions } from "jali/testing";
import { currentPlace, selectPlace, showDay } from "./actions";
import { day } from "./panes/day";
import { place } from "./panes/place";
import { addToDay } from "./planning";
import { createServices } from "./services";
import { DEFAULT_PLAN, dayOf } from "./trip/plan";
import { createTripsJali, kinds } from "./workspace";

/** The app's workspace with nothing shared: a memory address and storage, a fixed size, no DOM focus. */
function testJali({ search = "", width = 1440, height = 900 } = {}) {
  const notes: string[] = [];
  const services = createServices({ persist: false, notify: (t) => notes.push(t) });
  const { options, location } = testJaliOptions({ search, size: { width, height } });
  const jali = createTripsJali(services, options);
  return { jali, location, services, notes };
}

/** What the chooser was asked (the engine's state: what Jali's chooser dialog renders). */
const chooser = (jali: Jali) => {
  const request = chooserRequest(jali);
  if (!request) throw new Error("the chooser is not asking");
  return request;
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
    selectPlace(jali, "wat-pho", { from: "day" });
    expect(jali.get().selection.day?.ref).toEqual(place({ id: "wat-pho" }));
    expect(currentPlace(jali)).toBe("wat-pho");
    vi.advanceTimersByTime(200);
    expect(shows(jali, "place")).toEqual({ id: "wat-pho" });
  });

  it("compares two places: keep one, select another, and a second place pane opens beside it", () => {
    vi.useFakeTimers();
    const { jali } = testJali();
    jali.actions.setKept("place", true);
    const opened = selectPlace(jali, "h-silom");
    expect(opened).toBeTruthy();
    expect(jali.model().pane(opened)).toMatchObject({
      linkedTo: "map",
      follows: true,
      ref: place({ id: "h-silom" }),
    });
    expect(jali.model().pane("place")).toMatchObject({
      kept: true,
      ref: place({ id: "grand-palace" }),
    });
    // The next one goes to the following pane; the kept one stays.
    selectPlace(jali, "h-kata");
    vi.advanceTimersByTime(200);
    expect(shows(jali, opened!)).toEqual({ id: "h-kata" });
    expect(shows(jali, "place")).toEqual({ id: "grand-palace" });
  });

  it("opens Stay already comparing: one hotel kept, the other following the map", () => {
    const { jali } = testJali();
    jali.actions.preset("stay");
    expect(jali.model().pane("place-kept")).toMatchObject({ kept: true, linkedTo: "map" });
    expect(jali.model().pane("place")).toMatchObject({ follows: true, linkedTo: "map" });
    expect(jali.model().pane("explore")?.ref.params).toEqual({ category: "stay" });
  });

  it("lays the whole week in a row that scrolls: no day folds, each at its comfortable width", () => {
    for (const width of [1280, 1440, 3200]) {
      const { jali } = testJali({ width });
      jali.actions.preset("days");
      const m = jali.model();
      expect(m.folded).toEqual([]);
      expect(m.visible).toEqual(
        expect.arrayContaining(["overview", "day-1", "day-7", "map", "place"]),
      );
      const week = m.resolved.scrollers.find((s) => s.id === "week");
      if (width < 3200) expect(week).toBeDefined();
      for (let n = 1; n <= 7; n++)
        expect(m.content.panes.find((b) => b.id === `day-${n}`)!.rect.width).toBeGreaterThanOrEqual(
          360,
        );
    }
  });

  it("showing a day out of view focuses its pane, which the week then scrolls to (e2e)", () => {
    const { jali } = testJali({ width: 1440 });
    jali.actions.preset("days");
    expect(jali.model().outOfView.has("day-7")).toBe(true);
    showDay(jali, 7);
    expect(jali.get().view.focused).toBe("day-7");
  });

  it("keeps the layout, the day and the place in the address: a link reopens them", () => {
    vi.useFakeTimers();
    const { jali, location } = testJali();
    jali.actions.select("overview", day({ n: 6 }));
    selectPlace(jali, "nai-harn", { from: "day" });
    vi.advanceTimersByTime(200);
    const link = location.search();
    expect(new URLSearchParams(link).get("l")).toBeTruthy();

    const { jali: reader } = testJali({ search: link });
    expect(ids(reader)).toEqual(ids(jali));
    expect(shows(reader, "day")).toEqual({ n: 6 });
    expect(shows(reader, "map")).toEqual({ day: 6 });
    expect(shows(reader, "place")).toEqual({ id: "nai-harn" });
  });

  it("doesn't open a link to a place this trip doesn't have (an old Lisbon link): it opens the layout instead", () => {
    const { jali, location } = testJali();
    jali.actions.preset("days");
    const params = new URLSearchParams(location.search());
    const [version, body] = params.get("l")!.split(".");
    const json = Buffer.from(body!, "base64").toString("utf8");
    expect(json).toContain('"grand-palace"');
    const lisbon = Buffer.from(json.replace('"grand-palace"', '"castelo"'), "utf8")
      .toString("base64")
      .replace(/=+$/, "");
    params.set("l", `${version}.${lisbon}`);
    const { jali: reader } = testJali({ search: `?${params}` });
    expect(shows(reader, "place")).toEqual({ id: "grand-palace" });
    expect(reader.get().presetId).toBe("days");
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
    // The overview is the same pane (same id, same object); the day differs (Day 7), so it starts afresh.
    expect(jali.model().pane("overview")?.ref.kind).toBe("trip");
    expect(shows(jali, "day")).toEqual({ n: 7 });
  });

  it("lists the app's commands in ⌘K, with their keys", () => {
    const { jali } = testJali();
    const listed = listCommands(jali);
    for (const id of ["trips.go", "trips.add", "trips.optimise", "trips.undo", "trips.reset"])
      expect(
        listed.some((c) => c.id === id),
        id,
      ).toBe(true);
    expect(listed.find((c) => c.id === "trips.go")?.keys).toBe("⌘K ⌘P");
    expect(listed.some((c) => c.title === "Layout: Days")).toBe(true);
  });

  it("goes to a place from ⌘K", () => {
    vi.useFakeTimers();
    const { jali } = testJali();
    run(jali, "trips.go");
    choose(jali, "Big Buddha", "Go to place…");
    vi.advanceTimersByTime(200);
    expect(currentPlace(jali)).toBe("big-buddha");
    expect(shows(jali, "place")).toEqual({ id: "big-buddha" });
  });

  it("adds a place to a day from ⌘K: a place, then a day", () => {
    const { jali, services, notes } = testJali();
    run(jali, "trips.add");
    choose(jali, "Golden Mount", "Add to day…");
    // Only the days in its city are offered.
    expect(chooser(jali).items.map(chooser(jali).label)).toEqual([
      "Day 1: Temples of the old city",
      "Day 2: Chinatown, silk and the park",
      "Day 3: Markets and the Golden Mount",
    ]);
    // The Golden Mount is on Day 3 already, so it moves.
    choose(jali, /^Day 2/, "Add Golden Mount to…");
    expect(dayOf(services.plan.get(), 2)!.stops.at(-1)).toBe("golden-mount");
    expect(dayOf(services.plan.get(), 3)!.stops).not.toContain("golden-mount");
    expect(notes.at(-1)).toBe("Moved Golden Mount to Day 2");
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

  it("refuses a place on a day in the other city, and says why", () => {
    const { services, notes } = testJali();
    addToDay(services, "wat-pho", 6);
    expect(dayOf(services.plan.get(), 6)!.stops).not.toContain("wat-pho");
    expect(notes.at(-1)).toBe("Wat Pho is in Bangkok, and Day 6 is in Phuket");
  });

  it("asks only for hotels, to stay", () => {
    const { jali } = testJali();
    run(jali, "trips.stay");
    const request = chooser(jali);
    expect(request.items.map(request.label)).toContain("Kata Hillside Bungalows");
    expect(request.items.map(request.label)).not.toContain("Grand Palace");
  });

  it("shows a day: the pane that has it, else the overview's following day", () => {
    const { jali } = testJali();
    showDay(jali, 2);
    expect(shows(jali, "day")).toEqual({ n: 2 });
    expect(jali.get().view.focused).toBe("day");
    jali.actions.preset("days");
    expect(showDay(jali, 7)).toBe("day-7");
  });
});
