import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { listCommands, memoryLocation, memoryStorage, type Jali } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { openFollowing, sessionInLayout } from "./actions";
import { clip } from "./panes/clip";
import { transcript } from "./panes/transcript";
import { createServices } from "./services";
import { sessionById, wordsFor, type SegmentData } from "./sessions/sessions";
import { slashForSearch, spaceForTransport } from "./shell/keys";
import { createStudioJali, kinds } from "./workspace";

/** The app's workspace with nothing shared: a memory address and storage, a fixed size, no DOM focus, no sound. */
function testJali({ search = "", width = 1440, height = 808 } = {}) {
  const services = createServices({ persist: false, audio: false });
  const location = memoryLocation(search);
  const jali = createStudioJali(services, {
    url: { location },
    storage: memoryStorage(),
    size: { width, height },
    moveFocus: false,
    keymapOptions: { platform: "mac" },
  });
  return { jali, location, services };
}

/** What the chooser was asked (the engine's state: what Jali's chooser dialog renders). */
const chooser = (jali: Jali) => {
  const c = storeOf(jali).get().chooser;
  if (c?.kind !== "choose") throw new Error("the chooser is not asking");
  return c.request;
};
const run = (jali: Jali, id: string) =>
  listCommands(jali)
    .find((c) => c.id === id)!
    .run();

const ids = (jali: Jali) => jali.model().panes.map((p) => p.id);
const shown = (jali: Jali, id: string) => jali.model().pane(id)?.ref.params;
const FERRY = "night-ferry";
const SEEDS = "seed-library";

describe("the studio workspace", () => {
  afterEach(() => vi.useRealTimers());

  it("opens on Edit: a library, the panes that follow it, and a segment detail that follows the transcript", () => {
    const { jali } = testJali();
    expect(jali.get().presetId).toBe("edit");
    expect(ids(jali)).toEqual(["library", "transcript", "timeline", "clip"]);
    for (const id of ["transcript", "timeline"])
      expect(jali.model().pane(id)).toMatchObject({ linkedTo: "library", follows: true });
    expect(jali.model().pane("clip")).toMatchObject({ linkedTo: "transcript", follows: true });
    expect(sessionInLayout(jali)).toBe(FERRY);
  });

  it("has four layouts, each with rows and columns, and nothing folds at 1440 by 900", () => {
    for (const preset of ["edit", "mix", "review", "compare"]) {
      const { jali } = testJali();
      jali.actions.preset(preset);
      const kindsOf = jali.model().panes.map((p) => p.ref.kind);
      expect(kindsOf, preset).toContain("library");
      expect(jali.model().folded, preset).toEqual([]);
    }
  });

  it("gives every kind an honest minimum width, so a narrow window folds instead of squeezing", () => {
    for (const k of kinds) expect(k.width?.min, k.kind).toBeGreaterThanOrEqual(240);
    const narrow = testJali({ width: 900 }).jali;
    expect(narrow.model().folded.length).toBeGreaterThan(0);
    // Folded panes stay mounted and in the layout: the shelf lists them.
    expect(ids(narrow)).toEqual(["library", "transcript", "timeline", "clip"]);
  });

  it("moves every follower of the library together once its selection rests, each kind its own way", () => {
    vi.useFakeTimers();
    const { jali } = testJali();
    jali.actions.preset("mix");
    jali.actions.select("library", transcript({ session: SEEDS }));
    expect(shown(jali, "mixer")?.session).toBe(FERRY);
    vi.advanceTimersByTime(200);
    // The timeline, the mixer and the markers all show the selected session (their kinds' `follow`).
    for (const id of ["timeline", "mixer", "markers"]) expect(shown(jali, id)?.session).toBe(SEEDS);
  });

  it("follows a segment: the transcript selects it, and the detail shows it", () => {
    vi.useFakeTimers();
    const { jali } = testJali();
    jali.actions.select("transcript", clip({ session: FERRY, segment: "s05" }));
    vi.advanceTimersByTime(200);
    expect(shown(jali, "clip")).toEqual({ session: FERRY, segment: "s05" });
  });

  it("compares: keep the segment detail, open another, and the two sit side by side", () => {
    vi.useFakeTimers();
    const { jali } = testJali();
    jali.actions.setKept("clip", true);
    jali.actions.select("transcript", clip({ session: FERRY, segment: "s08" }));
    const opened = openFollowing(jali, "transcript", clip({ session: FERRY, segment: "s08" }))!;
    expect(opened).not.toBe("clip");
    expect(jali.model().pane(opened)).toMatchObject({ follows: true, linkedTo: "transcript" });
    expect(jali.model().pane("clip")).toMatchObject({
      kept: true,
      ref: clip({ session: FERRY, segment: "s01" }),
    });
    // The kept one stays as the cursor moves on; the new one follows.
    jali.actions.select("transcript", clip({ session: FERRY, segment: "s10" }));
    vi.advanceTimersByTime(200);
    expect(shown(jali, opened)?.segment).toBe("s10");
    expect(shown(jali, "clip")?.segment).toBe("s01");
  });

  it("starts Compare with one segment kept and one following", () => {
    vi.useFakeTimers();
    const { jali } = testJali();
    jali.actions.preset("compare");
    expect(jali.model().pane("clip-a")).toMatchObject({ kept: true, linkedTo: "transcript" });
    jali.actions.select("transcript", clip({ session: FERRY, segment: "s12" }));
    vi.advanceTimersByTime(200);
    expect(shown(jali, "clip")?.segment).toBe("s12");
    expect(shown(jali, "clip-a")?.segment).toBe("s04");
  });

  it("keeps the layout in the address: a link opens the same arrangement and session", () => {
    vi.useFakeTimers();
    const { jali, location } = testJali();
    jali.actions.preset("review");
    jali.actions.select("library", transcript({ session: SEEDS }));
    vi.advanceTimersByTime(200);
    const link = location.search();
    expect(new URLSearchParams(link).get("l")).toBeTruthy();
    expect(new URLSearchParams(link).get("preset")).toBe("review");

    const { jali: reader } = testJali({ search: link });
    expect(ids(reader)).toEqual(ids(jali));
    expect(reader.get().presetId).toBe("review");
    expect(sessionInLayout(reader)).toBe(SEEDS);
    expect(shown(reader, "timeline")?.session).toBe(SEEDS);
  });

  it("asks before a layout without the transcript loses its unsaved corrections", () => {
    const { jali } = testJali();
    // What the transcript's `useUnsaved` reports, and the Discard button: the engine's steps, as React calls them.
    const store = storeOf(jali);
    store.actions.setUnsaved("transcript", "2 unsaved corrections in “The night ferry”");
    expect(jali.actions.preset("mix")).toMatchObject({ ok: false, reason: "unsaved" });
    expect(store.get().confirm?.panes).toEqual(["transcript"]);
    expect(jali.get().presetId).toBe("edit");
    store.actions.discardAndContinue();
    expect(jali.get().presetId).toBe("mix");
  });

  it("moves to a layout that has the transcript without asking: the pane and its draft come along", () => {
    const { jali } = testJali();
    storeOf(jali).actions.setUnsaved("transcript", "1 unsaved correction");
    expect(jali.actions.preset("review")).toMatchObject({ ok: true });
    expect(jali.get().unsaved.transcript).toBeTruthy();
  });

  it("holds only the transcript while it has unsaved corrections: the other followers move on", () => {
    vi.useFakeTimers();
    const { jali } = testJali();
    // What the transcript's `useUnsaved` reports while its draft has corrections (panes/transcript.tsx).
    storeOf(jali).actions.setUnsaved("transcript", "1 unsaved correction");
    jali.actions.select("library", transcript({ session: SEEDS }));
    vi.advanceTimersByTime(200);
    expect(shown(jali, "transcript")?.session).toBe(FERRY);
    expect(shown(jali, "timeline")?.session).toBe(SEEDS);
    // It still follows, nothing is kept for it, and the workspace says why it stayed.
    expect(jali.model().pane("transcript")).toMatchObject({ follows: true });
    expect(jali.model().pane("transcript")?.kept).toBeFalsy();
    expect(storeOf(jali).get().announcement.text).toMatch(/stays put/);
    // Saved (or discarded): it catches up with the library at once.
    storeOf(jali).actions.setUnsaved("transcript", null);
    expect(shown(jali, "transcript")?.session).toBe(SEEDS);
  });

  it("lists the app's commands in ⌘K, with their keys", () => {
    const { jali } = testJali();
    const listed = listCommands(jali);
    expect(listed.find((c) => c.id === "studio.play")?.keys).toBe("⌘K ⌘P");
    expect(listed.find((c) => c.id === "studio.segment")?.keys).toBe("⌘K ⌘J");
    expect(listed.some((c) => c.title === "Jump to marker…")).toBe(true);
    expect(listed.some((c) => c.title === "Layout: Mix")).toBe(true);
  });

  it("asks for a segment in Jali's chooser, then goes there and selects it in the transcript", () => {
    const { jali, services } = testJali();
    run(jali, "studio.segment");
    const request = chooser(jali);
    expect(request.title).toBe("Go to segment…");
    // The person types a word from the line: it is in the label.
    const tomato = request.items.find((s) => request.label(s).includes("yellow"));
    expect(tomato).toBeUndefined(); // the ferry has no tomatoes
    const storm = request.items.find((s) =>
      request.label(s).startsWith("Once, in a winter storm"),
    ) as SegmentData;
    expect(request.hint!(storm)).toContain("Tomas Vell");
    request.onChoose(storm);
    expect(services.engine.position()).toBeCloseTo(storm.start);
    expect(jali.get().selection.transcript?.ref).toEqual(
      clip({ session: FERRY, segment: storm.id }),
    );
  });

  it("jumps to a marker, the person's own included", () => {
    const { jali, services } = testJali();
    services.edits.addMarker(FERRY, 42.5, "Good quote");
    run(jali, "studio.marker");
    const request = chooser(jali);
    const mine = request.items.find((m) => request.label(m) === "Good quote")!;
    expect(request.hint!(mine)).toBe("00:42");
    request.onChoose(mine);
    expect(services.engine.position()).toBeCloseTo(42.5);
  });

  it("leaves Space to the app: Jali binds no single key, and Space is reserved", () => {
    const { jali } = testJali();
    const single = jali.keymap.entries.flatMap(([, seqs]) =>
      seqs.filter((s) => s.length === 1 && s[0]!.key === " "),
    );
    expect(single).toEqual([]);
  });

  it("plays and pauses with Space everywhere but where Space types or presses something", () => {
    const key = (target: Element, init: KeyboardEventInit = {}) => {
      let event!: KeyboardEvent;
      target.addEventListener("keydown", (e) => (event = e as KeyboardEvent), { once: true });
      target.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, ...init }));
      return event;
    };
    const el = (html: string) => {
      const box = document.createElement("div");
      box.innerHTML = html;
      document.body.append(box);
      return box.firstElementChild!;
    };
    expect(spaceForTransport(key(document.body))).toBe(true);
    expect(spaceForTransport(key(el('<div role="listbox" tabindex="0"></div>')))).toBe(true);
    expect(spaceForTransport(key(el('<input type="range">')))).toBe(true);
    expect(spaceForTransport(key(el("<textarea></textarea>")))).toBe(false);
    expect(spaceForTransport(key(el("<input>")))).toBe(false);
    expect(spaceForTransport(key(el("<button>Mute</button>")))).toBe(false);
    expect(spaceForTransport(key(el('<div role="tab" tabindex="0"></div>')))).toBe(false);
    expect(
      spaceForTransport(
        key(el('<div role="dialog"><span tabindex="0"></span></div>').firstElementChild!),
      ),
    ).toBe(false);
    // Shift+Space is the lists' peek; a pane that claimed the key keeps it.
    expect(spaceForTransport(key(document.body, { shiftKey: true }))).toBe(false);
    const claimed = key(document.body, { cancelable: true });
    claimed.preventDefault();
    expect(spaceForTransport(claimed)).toBe(false);
    expect(slashForSearch(new KeyboardEvent("keydown", { key: "/" }))).toBe(true);
  });
});

describe("the transport", () => {
  afterEach(() => vi.useRealTimers());

  it("is a silent clock without Web Audio: play, seek, loop and stop at the end", () => {
    vi.useFakeTimers({
      toFake: ["setInterval", "clearInterval", "setTimeout", "performance", "Date"],
    });
    const { engine } = createServices({ persist: false, audio: false });
    engine.load(FERRY);
    expect(engine.get().status).toBe("ready");
    engine.play(10);
    vi.advanceTimersByTime(2000);
    expect(engine.position()).toBeCloseTo(12, 0);
    engine.setRate(1.5);
    vi.advanceTimersByTime(2000);
    expect(engine.position()).toBeCloseTo(15, 0);
    // A loop of one segment: the playhead wraps at its end.
    const seg = sessionById(FERRY)!.segments[3]!;
    engine.setLoop({ start: seg.start, end: seg.end, segment: seg.id });
    vi.advanceTimersByTime(((seg.end - seg.start) / 1.5) * 1000 + 300);
    expect(engine.position()).toBeGreaterThanOrEqual(seg.start);
    expect(engine.position()).toBeLessThan(seg.end);
    engine.setLoop(null);
    engine.seek(sessionById(FERRY)!.duration - 0.5);
    vi.advanceTimersByTime(2000);
    expect(engine.get().playing).toBe(false);
  });

  it("switches sessions paused, at the start", () => {
    const { engine } = createServices({ persist: false, audio: false });
    engine.play(20);
    engine.load(SEEDS);
    expect(engine.get()).toMatchObject({ session: SEEDS, playing: false, at: 0 });
  });
});

describe("corrections", () => {
  it("re-times a corrected line across the clip's voiced part", () => {
    const seg = sessionById(FERRY)!.segments[1]!;
    expect(wordsFor(seg, seg.text)).toBe(seg.words);
    const words = wordsFor(seg, "Thanks for having me here.");
    expect(words.map((w) => w[0])).toEqual(["Thanks", "for", "having", "me", "here."]);
    expect(words[0]![1]).toBeCloseTo(seg.voiced[0]);
    expect(words.at(-1)![2]).toBeCloseTo(seg.voiced[1]);
  });

  it("saves corrections in the app's store, and drops one put back as recorded", () => {
    const { edits } = createServices({ persist: false, audio: false });
    const seg = sessionById(FERRY)!.segments[0]!;
    edits.saveCorrections(FERRY, { [seg.id]: "Welcome back to Harbour Hours." });
    expect(edits.of(FERRY).corrections[seg.id]).toBe("Welcome back to Harbour Hours.");
    edits.saveCorrections(FERRY, { [seg.id]: seg.text });
    expect(edits.of(FERRY).corrections[seg.id]).toBeUndefined();
  });
});
