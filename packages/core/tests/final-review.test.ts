/**
 * The stabilisation round's final review (Codex and Opus, 23 Nov 2026, at 65043990). Each test follows the action to
 * its next consequence: the view closed, then asked for again; the address written, then opened in a fresh instance.
 */
import { describe, expect, it, vi } from "vite-plus/test";
import {
  column,
  createJali,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  type JaliOptions,
} from "@jali/core";
import { definePageEngine as definePage, paneDomId } from "@jali/core/adapter";
import { urlSync } from "../src/features/url-sync";

const record = { kind: "record", title: "Record", params: { id: Number }, width: { min: 260 } };
const r = (id: number) => ({ kind: "record", params: { id } });
const launcher = { kind: "launcher", title: "New pane", width: { min: 200 } };
const roles = [
  { id: "application", label: "Application", priority: "primary" as const },
  { id: "borrower", label: "Borrower", priority: "supporting" as const },
  { id: "history", label: "Loan history", priority: "supporting" as const },
];
const page = definePage({
  id: "review",
  name: "Review",
  itemNoun: "application",
  home: "application",
  roles,
  firstItem: 1,
  bind: (item: number) => ({
    application: r(item),
    borrower: r(100 + item),
    history: r(200 + item),
  }),
  build: (item: number) =>
    row(
      pane(r(item), { id: "application", role: "application", weight: 1.2 }),
      column(
        pane(r(100 + item), { id: "borrower", role: "borrower" }),
        pane(r(200 + item), { id: "history", role: "history" }),
      ),
    ),
});
const make = (o: Partial<JaliOptions> = {}, search = "") => {
  const location = memoryLocation(search);
  const jali = createJali({
    panes: [record],
    page,
    launcher,
    features: [urlSync({ location })],
    storage: memoryStorage(),
    size: { width: 1600, height: 900 },
    moveFocus: false,
    ...o,
  });
  jali.start();
  return { jali, location };
};
const split = (o: Partial<JaliOptions> = {}) => {
  const made = make(o);
  expect(made.jali.get().page).toBeTruthy();
  if (made.jali.get().page!.mode !== "split")
    expect(made.jali.page!.setMode("split").ok).toBe(true);
  return made;
};
const where = (jali: ReturnType<typeof make>["jali"], id: string) => jali.model().pane(id)?.where;

describe("1. a view closed with others is sent back to the page tabs, never deleted", () => {
  it("Close other tabs: the merged view goes back to the tabs, and asking for it shows it", () => {
    const { jali } = split();
    expect(jali.actions.mergeInto("borrower", "application").ok).toBe(true);
    expect(jali.actions.closeTabs("application", "others").ok).toBe(true);
    expect(where(jali, "borrower")).toBe("hidden");
    expect(jali.page!.showView("borrower").ok).toBe(true);
    expect(where(jali, "borrower")).toBe("shown");
    expect(jali.get().view.focused).toBe("borrower");
  });

  it("an opened pane closed with a view closes, and Undo brings back only the opened pane", () => {
    const { jali } = split();
    expect(jali.actions.openBeside("application", r(9)).ok).toBe(true);
    const opened = jali.model().panes.find((p) => p.ref.params.id === 9)!.id;
    expect(jali.actions.mergeInto("borrower", "application").ok).toBe(true);
    expect(jali.actions.mergeInto(opened, "application").ok).toBe(true);
    expect(jali.actions.closeTabs("application", "others").ok).toBe(true);
    expect(jali.model().pane(opened)).toBeUndefined();
    expect(where(jali, "borrower")).toBe("hidden");
    expect(jali.actions.undo().ok).toBe(true);
    expect(jali.model().pane(opened)).toBeDefined();
    expect(where(jali, "borrower")).toBe("hidden");
  });
});

describe("2. the last view on screen stays, whatever opened panes are beside it", () => {
  it("closing every view one by one stops at the last, and a tab click then still works", () => {
    const { jali } = split();
    expect(jali.actions.openBeside("application", r(9)).ok).toBe(true);
    expect(jali.actions.close("borrower").ok).toBe(true);
    expect(jali.actions.close("history").ok).toBe(true);
    const last = jali.actions.close("application");
    expect(last.ok).toBe(false);
    expect(last.reason).toBe("last-pane");
    expect(where(jali, "application")).toBe("shown");
    expect(jali.page!.showView("borrower").ok).toBe(true);
    expect(where(jali, "borrower")).toBe("shown");
  });

  it("Close other tabs can't send the last view back either", () => {
    const { jali } = split();
    expect(jali.actions.openBeside("application", r(9)).ok).toBe(true);
    const opened = jali.model().panes.find((p) => p.ref.params.id === 9)!.id;
    expect(jali.actions.close("borrower").ok).toBe(true);
    expect(jali.actions.close("history").ok).toBe(true);
    expect(jali.actions.mergeInto("application", opened).ok).toBe(true);
    const r1 = jali.actions.closeTabs(opened, "others");
    expect(r1.ok).toBe(false);
    expect(where(jali, "application")).not.toBe("hidden");
  });
});

describe("5. Single view has no layout to add a tab to", () => {
  it("New tab here is refused in Single view, and the page stays one view", () => {
    const { jali } = make();
    expect(jali.get().page).toBeTruthy();
    if (jali.get().page!.mode !== "single") expect(jali.page!.setMode("single").ok).toBe(true);
    expect(jali.actions.newTab().reason).toBe("single-view");
    expect(jali.model().panes).toHaveLength(1);
  });
});

describe("4. a page link keeps its maximised pane", () => {
  it("maximise a view in Split view: a reload opens the address maximised", () => {
    vi.useFakeTimers();
    // The same person's reload: Split view is their mode (a link opens in the reader's own mode).
    const storage = memoryStorage();
    const { jali, location } = split({ storage });
    expect(jali.actions.toggleZoom("application").ok).toBe(true);
    vi.advanceTimersByTime(1000);
    vi.useRealTimers();
    expect(location.search()).toContain("zoom=application");
    jali.destroy();
    const fresh = make({ storage }, location.search()).jali;
    expect(fresh.get().page?.mode).toBe("split");
    expect(fresh.get().view.zoomed).toBe("application");
  });

  it("a zoom the page's layout doesn't show is left out", () => {
    const fresh = make({}, "?page=review&item=1&tab=application&zoom=nope").jali;
    expect(fresh.get().view.zoomed).toBeUndefined();
  });
});

describe("3. a focus move queued for the next frame ends with its instance", () => {
  it("destroyed before the frame, a replacement with the same id keeps the host's focus", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => frames.push(f));
    const layout = row(pane(r(1), { id: "a" }), pane(r(2), { id: "b" }), pane(r(3), { id: "c" }));
    const mk = () =>
      createJali({
        id: "w",
        panes: [record],
        layout,
        storage: memoryStorage(),
        size: { width: 1600, height: 900 },
      });
    const old = mk();
    old.start();
    expect(old.actions.tuck("a").ok).toBe(true);
    expect(frames.length).toBeGreaterThan(0);
    old.destroy();
    // The replacement draws its panes under the same ids, and the person is in the host's own control.
    const fresh = mk();
    fresh.start();
    for (const id of ["a", "b", "c"]) {
      const el = document.createElement("div");
      el.id = paneDomId("w", id);
      el.tabIndex = -1;
      document.body.append(el);
    }
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    for (const f of frames.splice(0)) f(0);
    expect(document.activeElement).toBe(button);
    fresh.destroy();
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });
});
