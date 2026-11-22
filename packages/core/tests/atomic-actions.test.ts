/**
 * An action is all or nothing (architecture review 22 Nov 2026, P1-2). Its steps land together or not at all: a
 * refusal part way puts back what came before it, with no event, address write or announcement of it, and a question
 * that holds the action holds all of it. An action whose parts are separate on purpose says so with `each`.
 *
 * Before: Keep on a peek (`openPeekBeside`) closed the peek, then opening beside asked `beforeClose`, which said no.
 * The detail stayed, but the peek was gone.
 */
import { describe, expect, it } from "vite-plus/test";
import {
  createJali,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  toLayout,
  type JaliOptions,
} from "@jali/core";
import { each, refuse, storeOf } from "@jali/core/adapter";
import { urlSync } from "../src/features/url-sync";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 200 } };
const ref = (id: number) => ({ kind: "item", params: { id } });

const make = (o: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [item],
    layout: row(pane(ref(1), { id: "a" })),
    storage: memoryStorage(),
    size: { width: 1600, height: 800 },
    moveFocus: false,
    ...o,
  });

/** `a`, a detail it opened (showing 2), and a peek of 3 from `a`. */
function peeking(o: Partial<JaliOptions> = {}) {
  const jali = make(o);
  expect(jali.actions.openBeside("a", ref(2)).ok).toBe(true);
  expect(jali.actions.peek("a", ref(3)).ok).toBe(true);
  return jali;
}

describe("Keep on a peek, when opening beside would replace a detail", () => {
  it("refused by beforeClose: the peek stays open, and nothing else changed", () => {
    const jali = peeking({ beforeClose: () => false });
    const before = jali.get();
    const events: string[] = [];
    jali.on("layout", () => events.push("layout"));
    const r = storeOf(jali).actions.openPeekBeside();
    expect(r).toMatchObject({ ok: false, reason: "kept" });
    expect(jali.get().view.peek).toEqual(ref(3));
    expect(jali.get().layout).toBe(before.layout);
    expect(jali.get().view).toBe(before.view);
    expect(events).toEqual([]);
  });

  it("while beforeClose decides, the peek stays; a yes makes the whole action", async () => {
    let answer!: (yes: boolean) => void;
    const jali = peeking({ beforeClose: () => new Promise<boolean>((r) => (answer = r)) });
    const r = storeOf(jali).actions.openPeekBeside();
    expect(r.reason).toBe("pending");
    expect(jali.get().view.peek).toEqual(ref(3));
    answer(true);
    expect(await r.settled).toMatchObject({ ok: true });
    expect(jali.get().view.peek).toBeUndefined();
    expect(jali.model().panes.map((p) => p.ref)).toContainEqual(ref(3));
  });

  it("a later no keeps the peek", async () => {
    let answer!: (yes: boolean) => void;
    const jali = peeking({ beforeClose: () => new Promise<boolean>((r) => (answer = r)) });
    const r = storeOf(jali).actions.openPeekBeside();
    answer(false);
    expect(await r.settled).toMatchObject({ ok: false, reason: "kept" });
    expect(jali.get().view.peek).toEqual(ref(3));
  });
});

describe("a sequence refused part way", () => {
  it("puts back every change before the refusal, and tells nobody of them", () => {
    const location = memoryLocation();
    const jali = make({ features: [urlSync({ location })] });
    const store = storeOf(jali);
    const before = jali.get();
    const entries = location.entries.length;
    let told = 0;
    jali.subscribe(() => told++);
    const events: string[] = [];
    jali.on("layout", () => events.push("layout"));
    jali.on("focus", () => events.push("focus"));
    const r = store.apply([
      (x) => ({
        op: "open",
        layout: toLayout(row(pane(ref(1), { id: "a" }), pane(ref(9), { id: "z" }))),
        view: { ...x.s.view, focused: "z" },
        msg: "Opened 9",
      }),
      refuse("blocked", "Can't go there"),
    ]);
    expect(r).toMatchObject({ ok: false, reason: "blocked" });
    expect(jali.get().layout).toBe(before.layout);
    expect(jali.get().view).toBe(before.view);
    expect(location.entries.length).toBe(entries);
    expect(events).toEqual([]);
    // Only the refusal is said.
    expect(jali.get().announcement.text).toBe("Can't go there");
    expect(told).toBeLessThanOrEqual(1);
  });
});

describe("each", () => {
  it("keeps the parts that happened when a later one is refused, and answers with the refusal", () => {
    const jali = make();
    const store = storeOf(jali);
    const r = store.apply(
      each(
        (x) => ({
          op: "open",
          layout: toLayout(row(pane(ref(1), { id: "a" }), pane(ref(9), { id: "z" }))),
          view: x.s.view,
          msg: "Opened 9",
        }),
        refuse("blocked", "The other stays"),
      ),
    );
    expect(r).toMatchObject({ ok: false, reason: "blocked" });
    expect(jali.model().panes.map((p) => p.id)).toEqual(["a", "z"]);
    expect(jali.get().announcement.text).toMatch(/Opened 9.*The other stays/);
  });
});
