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
import {
  definePageEngine as definePage,
  layout as L,
  paneDomId,
  paneMenuOf,
  paneStateFor,
  storeOf,
} from "@jali/core/adapter";
import { answerDiscard, discardQuestion, reportUnsaved } from "@jali/core/testing";
import { urlSync } from "../src/features/url-sync";
import { withInput } from "../src/dom/input";

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

describe("1, after: Undo never puts a pane back beside a view the page hid since", () => {
  it("close the opened tab, then its neighbour view: Undo brings the opened pane back, the view stays hidden", () => {
    const { jali } = split();
    expect(jali.actions.openBeside("application", r(9)).ok).toBe(true);
    const opened = jali.model().panes.find((p) => p.ref.params.id === 9)!.id;
    expect(jali.actions.mergeInto("borrower", "application").ok).toBe(true);
    expect(jali.actions.mergeInto(opened, "borrower").ok).toBe(true);
    expect(jali.actions.close(opened).ok).toBe(true);
    expect(jali.actions.close("borrower").ok).toBe(true);
    expect(jali.actions.undo().ok).toBe(true);
    expect(where(jali, opened)).not.toBe("hidden");
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

describe("6. a pane undo puts back under a new id never takes a container's", () => {
  it("a row named pane-1: the restored pane gets an id no node has, and the layout stays valid", () => {
    const { jali } = make({
      page: undefined,
      layout: row(
        { id: "pane-1" },
        pane(r(1), { id: "a" }),
        pane(r(2), { id: "pane-2", linkedTo: "a" }),
        pane(r(4), { id: "c" }),
      ),
    });
    expect(jali.actions.close("pane-2").ok).toBe(true);
    expect(jali.actions.openBeside("a", r(3)).ok).toBe(true);
    expect(jali.model().pane("pane-2")?.ref.params.id).toBe(3);
    expect(jali.actions.undo().ok).toBe(true);
    const ids = jali.model().panes.map((p) => p.id);
    expect(ids).not.toContain("pane-1");
    expect(jali.getLayout().root.id).toBe("pane-1");
    expect(jali.model().panes.find((p) => p.ref.params.id === 2)).toBeDefined();
  });
});

describe("7. a close answered through the discard question keeps the input that asked for it", () => {
  it("a keyboard close of a dirty pane, Discard clicked: the close event says keyboard", () => {
    const { jali } = make({
      page: undefined,
      layout: row(pane(r(1), { id: "a" }), pane(r(2), { id: "b" })),
    });
    const inputs: string[] = [];
    jali.on("close", (e) => inputs.push(e.input));
    reportUnsaved(jali, "b", "a draft");
    expect(withInput("keyboard", () => jali.actions.close("b")).reason).toBe("unsaved");
    expect(withInput("mouse", () => answerDiscard(jali, "discard")).ok).toBe(true);
    expect(jali.model().pane("b")).toBeUndefined();
    expect(inputs).toEqual(["keyboard"]);
  });
});

describe("11. a close the host's beforeClose made itself", () => {
  it("is done, not refused: the pane is gone and the close is heard once", () => {
    let jali!: ReturnType<typeof make>["jali"];
    let asked = 0;
    ({ jali } = make({
      page: undefined,
      layout: row(pane(r(1), { id: "a" }), pane(r(2), { id: "b" }), pane(r(3), { id: "c" })),
      beforeClose: ({ panes }) => {
        // The host's own close asks it again; the second time it just agrees.
        if (panes[0]?.pane === "b" && !asked++) expect(jali.actions.close("b").ok).toBe(true);
        return true;
      },
    }));
    const heard: string[] = [];
    jali.on("close", (e) => heard.push(e.pane));
    expect(jali.actions.close("b").ok).toBe(true);
    expect(jali.model().pane("b")).toBeUndefined();
    expect(heard).toEqual(["b"]);
  });
});

describe("9. a tab never erases a draft another tab saved", () => {
  const layout = row(pane(r(1), { id: "a" }), pane(r(2), { id: "b" }));
  const mk = (storage: ReturnType<typeof memoryStorage>) =>
    createJali({
      panes: [record],
      layout,
      storage,
      size: { width: 1600, height: 900 },
      moveFocus: false,
    });
  const draftOf = (j: ReturnType<typeof mk>) =>
    paneStateFor(storeOf(j).get(), storeOf(j).env.kinds, "b", r(2))?.draft;
  const flush = (j: ReturnType<typeof mk>) => storeOf(j).paneStates.flush(storeOf(j).get());

  it("B, opened after A saved, closes b for good: A's reload still has its draft", () => {
    const storage = memoryStorage();
    const A = mk(storage);
    storeOf(A).actions.setPaneState("b", "draft", "my long reply");
    flush(A);
    const B = mk(storage);
    expect(B.actions.close("b").ok).toBe(true);
    expect(B.actions.remove("b").ok).toBe(true);
    flush(B);
    A.destroy();
    expect(draftOf(mk(storage))).toBe("my long reply");
  });

  it("B wrote b's state before A saved over it: B closing b leaves A's record", () => {
    const storage = memoryStorage();
    const A = mk(storage),
      B = mk(storage);
    storeOf(B).actions.setPaneState("b", "scroll", 10);
    flush(B);
    storeOf(A).actions.setPaneState("b", "draft", "my long reply");
    flush(A);
    expect(B.actions.close("b").ok).toBe(true);
    expect(B.actions.remove("b").ok).toBe(true);
    flush(B);
    A.destroy();
    expect(draftOf(mk(storage))).toBe("my long reply");
  });

  it("this tab's own record of a pane gone for good is still removed", () => {
    const storage = memoryStorage();
    const A = mk(storage);
    storeOf(A).actions.setPaneState("b", "draft", "x");
    flush(A);
    expect(A.actions.close("b").ok).toBe(true);
    expect(A.actions.remove("b").ok).toBe(true);
    flush(A);
    A.destroy();
    expect(draftOf(mk(storage))).toBeUndefined();
  });
});

describe("10. a menu's Maximise and Full screen set what the menu showed", () => {
  const two = () =>
    make({ page: undefined, layout: row(pane(r(1), { id: "a" }), pane(r(2), { id: "b" })) }).jali;
  const item = (j: ReturnType<typeof two>, id: string) =>
    paneMenuOf(storeOf(j), "a")
      .flat()
      .find((i) => i.id === id)!;

  it("Maximise chosen after a key maximised the pane leaves it maximised", () => {
    const jali = two();
    const zoom = item(jali, "zoom");
    expect(jali.actions.toggleZoom("a").ok).toBe(true);
    zoom.run({ id: "a", ref: r(1) });
    expect(jali.get().view.zoomed).toBe("a");
  });

  it("Restore chosen after the pane was restored leaves it restored", () => {
    const jali = two();
    expect(jali.actions.toggleZoom("a").ok).toBe(true);
    const zoom = item(jali, "zoom");
    expect(jali.actions.toggleZoom("a").ok).toBe(true);
    zoom.run({ id: "a", ref: r(1) });
    expect(jali.get().view.zoomed).toBeUndefined();
  });

  it("Full screen chosen after the pane went full screen leaves it there", () => {
    const jali = two();
    const full = item(jali, "full-screen");
    expect(jali.actions.toggleFullScreen("a").ok).toBe(true);
    full.run({ id: "a", ref: r(1) });
    expect(storeOf(jali).get().fullScreen).toBe("a");
  });
});

describe("12. a pane id that names something on every object", () => {
  it('"toString" in stacked phone view is a pane like any other: not one of the two, so not shown', () => {
    const { jali } = make({
      page: undefined,
      size: { width: 378, height: 760 },
      phone: { stack: true },
      layout: row(
        pane(r(1), { id: "a" }),
        pane(r(2), { id: "b", linkedTo: "a" }),
        pane(r(3), { id: "toString" }),
      ),
    });
    const where = Object.fromEntries(jali.model().panes.map((p) => [p.id, p.where]));
    expect(Object.values(where).filter((w) => w === "shown")).toHaveLength(2);
    expect(where.toString).not.toBe("shown");
  });
});

describe("14. the step table and undo's gate", () => {
  it("a step name the instance doesn't have is refused as invalid, never thrown", () => {
    const { jali } = make({ page: undefined, layout: row(pane(r(1), { id: "a" })) });
    for (const name of ["nope", "toString", "constructor"])
      expect((storeOf(jali).run as (n: string) => { reason?: string })(name).reason).toBe(
        "invalid",
      );
  });

  it("undo of a tuck goes through put back's gate", () => {
    const { jali } = make({
      page: undefined,
      layout: row(pane(r(1), { id: "a" }), pane(r(2), { id: "b" }), pane(r(3), { id: "c" })),
    });
    expect(jali.actions.tuck("a").ok).toBe(true);
    expect(jali.actions.undo().ok).toBe(true);
    expect(jali.model().pane("a")?.where).toBe("shown");
  });
});

// ---------- Codex's confirming pass (at 23595a98): each rule, not only the case that broke it ----------

describe("C1. a tab removes only records it wrote, whatever their content and time", () => {
  it("A and B write the same draft in the same millisecond; A closes the pane for good; B's record stays", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const storage = memoryStorage();
    const layout = row(pane(r(1), { id: "a" }), pane(r(2), { id: "b" }));
    const mk = () =>
      createJali({
        panes: [record],
        layout,
        storage,
        size: { width: 1600, height: 900 },
        moveFocus: false,
      });
    const flush = (j: ReturnType<typeof mk>) => storeOf(j).paneStates.flush(storeOf(j).get());
    const A = mk(),
      B = mk();
    storeOf(A).actions.setPaneState("b", "draft", "same");
    flush(A);
    storeOf(B).actions.setPaneState("b", "draft", "same");
    flush(B);
    expect(A.actions.close("b").ok).toBe(true);
    expect(A.actions.remove("b").ok).toBe(true);
    flush(A);
    now.mockRestore();
    const fresh = mk();
    expect(paneStateFor(storeOf(fresh).get(), storeOf(fresh).env.kinds, "b", r(2))?.draft).toBe(
      "same",
    );
  });
});

describe("C2. undo gives every node it makes or puts back an id no other node has", () => {
  it("a column named pane-2 made again around a pane restored as pane-2", () => {
    const { jali } = make({
      page: undefined,
      layout: column({ id: "pane-2" }, pane(r(1), { id: "a" }), pane(r(2), { id: "pane-1" })),
    });
    expect(jali.actions.close("pane-1").ok).toBe(true);
    expect(jali.actions.openBeside("a", r(3)).ok).toBe(true);
    expect(jali.actions.undo().ok).toBe(true);
    const all = L.tree.nodes(jali.getLayout().root).map((n) => n.id);
    expect(new Set(all).size).toBe(all.length);
    expect(jali.model().paneOf(r(2))).toBeDefined();
  });
});

describe("C3. after any close on a page, a view is shown", () => {
  it("a view behind an opened pane's tab doesn't count: closing the last shown view is refused", () => {
    const { jali } = split();
    expect(jali.actions.openBeside("application", r(9)).ok).toBe(true);
    const opened = jali.model().paneOf(r(9))!.id;
    expect(jali.actions.close("history").ok).toBe(true);
    expect(jali.actions.mergeInto("borrower", opened).ok).toBe(true);
    expect(jali.actions.focus(opened).ok).toBe(true);
    expect(where(jali, "borrower")).toBe("tab");
    jali.actions.close("application");
    const views = ["application", "borrower", "history"];
    const shownViews = jali
      .model()
      .panes.filter((p) => views.includes(p.id) && p.where === "shown");
    expect(shownViews.length).toBeGreaterThan(0);
    expect(jali.page!.showView("history").ok).toBe(true);
  });
});

describe("C4. a page link's zoom on an opened pane maximises the same object when reopened", () => {
  it("close the first of three opened panes, maximise the middle one: a reload maximises that record", () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const { jali, location } = split({ storage });
    expect(jali.actions.openBeside("application", r(9)).ok).toBe(true);
    const first = jali.model().paneOf(r(9))!.id;
    for (const id of [10, 11]) expect(jali.actions.addTab(first, r(id)).ok).toBe(true);
    expect(jali.actions.close(jali.model().paneOf(r(9))!.id).ok).toBe(true);
    expect(jali.actions.toggleZoom(jali.model().paneOf(r(10))!.id).ok).toBe(true);
    vi.advanceTimersByTime(1000);
    jali.destroy();
    const fresh = make({ storage }, location.search()).jali;
    vi.useRealTimers();
    const zoomed = fresh.get().view.zoomed;
    expect(zoomed && fresh.model().pane(zoomed)?.ref).toEqual(r(10));
  });

  it("a page link without a zoom, or with one that names no opened pane, maximises nothing", () => {
    for (const zoom of ["", "&zoom=~x", "&zoom=~0", "&zoom=~9"])
      expect(
        make({}, `?page=review&item=1&tab=application&open=record~id=9${zoom}`).jali.get().view
          .zoomed,
      ).toBeUndefined();
  });

  it("each opened pane in turn, maximised, is the one a reload maximises", () => {
    for (const target of [9, 10, 11]) {
      vi.useFakeTimers();
      const storage = memoryStorage();
      const { jali, location } = split({ storage });
      expect(jali.actions.openBeside("application", r(9)).ok).toBe(true);
      const first = jali.model().paneOf(r(9))!.id;
      for (const id of [10, 11]) expect(jali.actions.addTab(first, r(id)).ok).toBe(true);
      expect(jali.actions.toggleZoom(jali.model().paneOf(r(target))!.id).ok).toBe(true);
      vi.advanceTimersByTime(1000);
      jali.destroy();
      const fresh = make({ storage }, location.search()).jali;
      vi.useRealTimers();
      const zoomed = fresh.get().view.zoomed;
      expect(zoomed && fresh.model().pane(zoomed)?.ref).toEqual(r(target));
    }
  });
});

describe("C5. only a close is done by the host's own close, and only when its panes are gone", () => {
  it("openHere whose pane beforeClose closed itself: ok only if the object is open", () => {
    let jali!: ReturnType<typeof make>["jali"];
    let asked = 0;
    ({ jali } = make({
      page: undefined,
      layout: row(pane(r(1), { id: "a" }), pane(r(2), { id: "b" })),
      beforeClose: ({ panes }) => {
        if (panes[0]?.pane === "b" && !asked++) jali.actions.close("b");
        return true;
      },
    }));
    const res = jali.actions.openHere("b", r(9));
    expect(res.ok).toBe(!!jali.model().paneOf(r(9)));
  });
});

describe("C6. a menu's Maximise and Full screen set their pane's value whatever another pane has", () => {
  const three = () =>
    make({
      page: undefined,
      layout: row(pane(r(1), { id: "a" }), pane(r(2), { id: "b" }), pane(r(3), { id: "c" })),
    }).jali;
  const item = (j: ReturnType<typeof three>, id: string) =>
    paneMenuOf(storeOf(j), "a")
      .flat()
      .find((i) => i.id === id)!;

  it("A's Maximise, chosen after B was maximised, maximises A", () => {
    const jali = three();
    const zoom = item(jali, "zoom");
    expect(jali.actions.toggleZoom("b").ok).toBe(true);
    zoom.run({ id: "a", ref: r(1) });
    expect(jali.get().view.zoomed).toBe("a");
  });

  it("A's Restore, chosen after B was maximised instead, leaves B maximised", () => {
    const jali = three();
    expect(jali.actions.toggleZoom("a").ok).toBe(true);
    const zoom = item(jali, "zoom");
    expect(jali.actions.toggleZoom("b").ok).toBe(true);
    zoom.run({ id: "a", ref: r(1) });
    expect(jali.get().view.zoomed).toBe("b");
  });

  it("A's Full screen, chosen after B went full screen, puts A on the whole screen", () => {
    const jali = three();
    const full = item(jali, "full-screen");
    expect(jali.actions.toggleFullScreen("b").ok).toBe(true);
    full.run({ id: "a", ref: r(1) });
    expect(storeOf(jali).get().fullScreen).toBe("a");
  });
});

describe("C7. a host's own close, answered later, is done", () => {
  it("beforeClose closes b, then answers yes by a promise: the close settles ok", async () => {
    let jali!: ReturnType<typeof make>["jali"];
    let asked = 0;
    ({ jali } = make({
      page: undefined,
      layout: row(pane(r(1), { id: "a" }), pane(r(2), { id: "b" }), pane(r(3), { id: "c" })),
      beforeClose: ({ panes }) => {
        if (panes[0]?.pane === "b" && !asked++) {
          jali.actions.close("b");
          return Promise.resolve(true);
        }
        return true;
      },
    }));
    const res = jali.actions.close("b");
    const end = res.reason === "pending" ? await res.settled! : res;
    expect(end.ok).toBe(true);
    expect(jali.model().pane("b")).toBeUndefined();
  });
});

describe("C8. every question an action asks keeps the input that asked for it", () => {
  it("keyboard Close others, a second dirty pane asks again: both answers commit as keyboard", () => {
    const { jali } = make({
      page: undefined,
      layout: row(pane(r(1), { id: "a" }), pane(r(2), { id: "b" }), pane(r(3), { id: "c" })),
    });
    const inputs: string[] = [];
    jali.on("close", (e) => inputs.push(e.input));
    reportUnsaved(jali, "b", "draft b");
    expect(withInput("keyboard", () => jali.actions.closeOthers("a")).reason).toBe("unsaved");
    reportUnsaved(jali, "c", "draft c");
    withInput("mouse", () => answerDiscard(jali, "discard"));
    expect(discardQuestion(jali)).not.toBeNull();
    withInput("mouse", () => answerDiscard(jali, "discard"));
    expect(jali.model().panes.map((p) => p.id)).toEqual(["a"]);
    expect(inputs).toEqual(["keyboard", "keyboard"]);
  });
});

// ---------- Codex's second confirming pass (at 6bdacf84): each rule held by construction ----------

const VIEWS = ["application", "borrower", "history"];
const viewShown = (jali: ReturnType<typeof make>["jali"]) =>
  jali.model().panes.some((p) => VIEWS.includes(p.id) && p.where === "shown");

describe("D1. every close on a page leaves a view shown", () => {
  it("Codex's sequence: closing an opened pane never leaves only opened panes in front", () => {
    const { jali } = split();
    expect(jali.actions.openBeside("application", r(9)).ok).toBe(true);
    const x = jali.model().paneOf(r(9))!.id;
    expect(jali.actions.openBeside(x, r(10)).ok).toBe(true);
    const y = jali.model().paneOf(r(10))!.id;
    expect(jali.actions.close("history").ok).toBe(true);
    expect(jali.actions.mergeInto("application", x).ok).toBe(true);
    expect(jali.actions.mergeInto("borrower", x).ok).toBe(true);
    expect(jali.actions.setPinned("borrower", true).ok).toBe(true);
    jali.actions.closeTabs(x, "others");
    expect(viewShown(jali)).toBe(true);
    jali.actions.close(y);
    expect(viewShown(jali)).toBe(true);
    expect(jali.page!.showView("history").ok).toBe(true);
  });

  it("random page sequences: after every close of any shape, a view is shown", () => {
    const problems: string[] = [];
    for (let seed = 1; seed <= 150 && problems.length < 3; seed++) {
      let n = seed;
      const rand = () => (n = (n * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
      const { jali } = split();
      const log: string[] = [];
      for (let i = 0; i < 30; i++) {
        const ids = jali.model().panes.map((p) => p.id);
        const p = ids[Math.floor(rand() * ids.length)]!,
          q = ids[Math.floor(rand() * ids.length)]!,
          v = VIEWS[Math.floor(rand() * 3)]!;
        const a = jali.actions;
        const steps: [string, boolean, () => { ok: boolean }][] = [
          ["openBeside", false, () => a.openBeside(p, r(9 + Math.floor(rand() * 6)))],
          ["addTab", false, () => a.addTab(p, r(20 + Math.floor(rand() * 6)))],
          ["mergeInto", false, () => a.mergeInto(p, q)],
          ["setPinned", false, () => a.setPinned(p, rand() < 0.5)],
          ["focus", false, () => a.focus(p)],
          ["showView", false, () => jali.page!.showView(v)],
          ["close", true, () => a.close(p)],
          ["closeOthers", true, () => a.closeOthers(p)],
          ["closeTabs others", true, () => a.closeTabs(p, "others")],
          ["closeTabs after", true, () => a.closeTabs(p, "after")],
          ["back", true, () => jali.page!.back()],
          ["undo", false, () => a.undo()],
        ];
        const [name, isClose, run] = steps[Math.floor(rand() * steps.length)]!;
        const res = run();
        const arg = name === "showView" ? v : name === "mergeInto" ? `${p}, ${q}` : p;
        log.push(`${name}(${arg}) ${res.ok ? "ok" : "no"}`);
        if (isClose && res.ok && !viewShown(jali)) {
          problems.push(`seed ${seed}: no view shown after ${log.slice(-8).join(" · ")}`);
          break;
        }
      }
      jali.destroy();
    }
    expect(problems.join("\n")).toBe("");
  });
});

describe("D3. a page link's zoom reads back to the same pane, whatever a view is called", () => {
  it("a view named like an opened pane's place (~1), maximised, is the one a reload maximises", () => {
    vi.useFakeTimers();
    const odd = definePage({
      id: "odd",
      name: "Odd",
      itemNoun: "item",
      home: "~1",
      roles: [
        { id: "~1", label: "First", priority: "primary" as const },
        { id: "side", label: "Side", priority: "supporting" as const },
      ],
      firstItem: 1,
      bind: (item: number) => ({ "~1": r(item), side: r(100 + item) }),
      build: (item: number) =>
        row(
          pane(r(item), { id: "~1", role: "~1" }),
          pane(r(100 + item), { id: "side", role: "side" }),
        ),
    });
    const storage = memoryStorage();
    const { jali, location } = make({ page: odd, storage });
    if (jali.get().page!.mode !== "split") expect(jali.page!.setMode("split").ok).toBe(true);
    expect(jali.actions.openBeside("~1", r(9)).ok).toBe(true);
    expect(jali.actions.toggleZoom("~1").ok).toBe(true);
    vi.advanceTimersByTime(1000);
    jali.destroy();
    const fresh = make({ page: odd, storage }, location.search()).jali;
    vi.useRealTimers();
    expect(fresh.get().view.zoomed).toBe("~1");
  });
});
