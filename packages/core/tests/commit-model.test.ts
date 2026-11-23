/**
 * The commit model (docs/reviews/2026-11-23/PLAN.md, step 2). An action is a proposal until it commits: a hold or a
 * refusal discards it, and nothing needs putting back. What others write meanwhile (a pane's reports and own state,
 * the host's own actions inside `beforeClose`) are commits of their own, and stay. After a yes the action is worked
 * out again against the state then, and asks again only if it would now lose other work. A destroyed instance commits,
 * writes, announces and tells nothing more, and every `settled` resolves.
 *
 * Findings A2-1 (Keep editing lost the draft the guard saved) and A2-3 (a guard that destroyed the instance still saw
 * the close succeed, or never settled).
 */
import { describe, expect, it } from "vite-plus/test";
import {
  createJali,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  type ActionResult,
  type JaliOptions,
} from "@jali/core";
import { paneStateFor, storeOf } from "@jali/core/adapter";
import { urlSync } from "../src/features/url-sync";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 200 } };
const ref = (id: number) => ({ kind: "item", params: { id } });
type Jali = ReturnType<typeof createJali>;
const three = row(pane(ref(1), { id: "a" }), pane(ref(2), { id: "b" }), pane(ref(3), { id: "c" }));
const make = (guard: (jali: Jali) => boolean | Promise<boolean>, o: Partial<JaliOptions> = {}) => {
  let jali!: Jali;
  jali = createJali({
    panes: [item],
    layout: three,
    storage: memoryStorage(),
    size: { width: 1600, height: 800 },
    moveFocus: false,
    beforeClose: () => guard(jali),
    ...o,
  });
  return jali;
};
const ids = (jali: Jali) => jali.model().panes.map((p) => p.id);
const draftOf = (jali: Jali, id: string) => {
  const s = storeOf(jali);
  return paneStateFor(s.get(), s.env.kinds, id, s.model().pane(id)!.ref);
};
/** Every event the app hears, by name. */
const listen = (jali: Jali) => {
  const heard: string[] = [];
  for (const e of ["close", "open", "pin", "focus", "layout", "toast"] as const)
    jali.on(e, () => heard.push(e));
  return heard;
};

describe("what the guard writes while it decides", () => {
  it("Keep editing leaves the draft and the unsaved mark it reported, and closing again asks again (A2-1)", () => {
    const jali = make((j) => {
      storeOf(j).actions.setPaneState("b", "draft", "half a sentence");
      storeOf(j).actions.setUnsaved("b", "a draft");
      return true;
    });
    expect(jali.actions.close("b")).toMatchObject({ ok: false, reason: "unsaved" });
    storeOf(jali).actions.keepEditing();
    expect(storeOf(jali).get().confirm).toBeNull();
    expect(jali.get().unsaved).toEqual({ b: "a draft" });
    expect(draftOf(jali, "b")).toEqual({ draft: "half a sentence" });
    // The work is still there, so closing again asks again, and Discard then closes the pane and forgets the draft.
    expect(jali.actions.close("b")).toMatchObject({ ok: false, reason: "unsaved" });
    storeOf(jali).actions.discardAndContinue();
    expect(ids(jali)).toEqual(["a", "c"]);
    expect(jali.get().unsaved).toEqual({});
  });

  it("a pin it makes is its own commit: it lands at once, and stands when the guard says no", () => {
    const location = memoryLocation();
    let inner: ActionResult | undefined;
    const jali = make((j) => ((inner = j.actions.setPinned("a", true)), false), {
      features: [urlSync({ location })],
    });
    const heard: string[] = [];
    jali.on("pin", (e) => heard.push(`${e.pane} ${e.pinned}`));
    expect(jali.actions.close("b")).toMatchObject({ ok: false, reason: "kept" });
    expect(inner).toMatchObject({ ok: true });
    expect(heard).toEqual(["a true"]);
    expect(ids(jali)).toEqual(["a", "b", "c"]);
    // The address holds the pin: a fresh instance on it opens A pinned.
    const reader = make(() => true, {
      features: [urlSync({ location: memoryLocation(location.search()) })],
    });
    expect(reader.model().pane("a")?.pinned).toBe(true);
  });

  it("a pin it makes stands while the guard holds the close, and after it says yes", async () => {
    let answer!: (yes: boolean) => void;
    const jali = make((j) => {
      j.actions.setPinned("a", true);
      return new Promise<boolean>((r) => (answer = r));
    });
    const r = jali.actions.close("b");
    expect(r.reason).toBe("pending");
    expect(jali.model().pane("a")?.pinned).toBe(true);
    answer(true);
    await expect(r.settled).resolves.toMatchObject({ ok: true });
    expect(ids(jali)).toEqual(["a", "c"]);
    expect(jali.model().pane("a")?.pinned).toBe(true);
  });

  it("a held close asks again when, by the yes, it would close a pane opened meanwhile", async () => {
    const asked: string[][] = [];
    let answer!: (yes: boolean) => void;
    const jali = createJali({
      panes: [item],
      layout: three,
      storage: memoryStorage(),
      size: { width: 1600, height: 800 },
      moveFocus: false,
      beforeClose: ({ panes }) => {
        asked.push(panes.map((p) => p.pane));
        return asked.length === 1 ? new Promise<boolean>((r) => (answer = r)) : true;
      },
    });
    const r = jali.actions.closeOthers("a");
    expect(r.reason).toBe("pending");
    const opened = jali.actions.openBeside("a", ref(4));
    answer(true);
    await r.settled;
    expect(asked.map((a) => a.sort())).toEqual([["b", "c"], ["b", "c", opened.pane!].sort()]);
    expect(ids(jali)).toEqual(["a"]);
  });
});

describe("a held yes, then a yes that writes", () => {
  it("closes what both yeses allowed, though the second guard pinned a pane", async () => {
    let answer!: (yes: boolean) => void;
    let asked = 0;
    let jali!: Jali;
    jali = createJali({
      panes: [item],
      layout: three,
      storage: memoryStorage(),
      size: { width: 1600, height: 800 },
      moveFocus: false,
      beforeClose: () => {
        if (++asked === 1) return new Promise<boolean>((r) => (answer = r));
        jali.actions.setPinned("a", true);
        return true;
      },
    });
    const r = jali.actions.closeOthers("a");
    jali.actions.openBeside("a", ref(4));
    answer(true);
    await expect(r.settled).resolves.toMatchObject({ ok: true });
    expect(ids(jali)).toEqual(["a"]);
    expect(jali.model().pane("a")?.pinned).toBe(true);
  });
});

describe("an instance destroyed inside the guard (A2-3)", () => {
  it("that then says yes: the panes stay, nothing is told, and the close is unavailable", () => {
    const jali = make((j) => (j.destroy(), true));
    const heard = listen(jali);
    expect(jali.actions.close("b")).toEqual({ ok: false, reason: "unavailable" });
    expect(ids(jali)).toEqual(["a", "b", "c"]);
    expect(heard).toEqual([]);
  });

  it("that then holds: the panes stay, nothing is told, and settled resolves", async () => {
    const jali = make((j) => (j.destroy(), new Promise<boolean>(() => {})));
    const heard = listen(jali);
    const r = jali.actions.close("b");
    expect(r.ok).toBe(false);
    await expect(r.settled ?? Promise.resolve(r)).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(ids(jali)).toEqual(["a", "b", "c"]);
    expect(heard).toEqual([]);
  });

  it("a later yes to a hold it outlived changes nothing", async () => {
    let answer!: (yes: boolean) => void;
    const jali = make(() => new Promise<boolean>((r) => (answer = r)));
    const heard = listen(jali);
    const r = jali.actions.close("b");
    jali.destroy();
    answer(true);
    await expect(r.settled).resolves.toEqual({ ok: false, reason: "unavailable" });
    await new Promise((done) => setTimeout(done, 0));
    expect(ids(jali)).toEqual(["a", "b", "c"]);
    expect(heard).toEqual([]);
  });

  it("from a step's own callback: what the step returns commits nothing", () => {
    const jali = make(() => true);
    const heard = listen(jali);
    const r = storeOf(jali).apply(() => {
      jali.destroy();
      return { op: "close", layout: storeOf(jali).get().layout, msg: "Closed" };
    });
    expect(r).toEqual({ ok: false, reason: "unavailable" });
    expect(heard).toEqual([]);
    expect(storeOf(jali).get().announcement.text).toBe("");
  });

  it("from a listener: the batches still to be told are dropped", () => {
    const jali = make(() => true);
    const heard: string[] = [];
    jali.on("close", () => {
      heard.push("close");
      jali.destroy();
    });
    jali.on("layout", () => heard.push("layout"));
    jali.actions.close("b");
    expect(heard).toEqual(["close"]);
  });
});
