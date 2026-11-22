/**
 * A curated page's limited viewer (docs/reviews/QUALITY-REVIEW.md C10, docs/DECISIONS.md 20 Nov 2026): taking the right to
 * investigate away in Split view is one change, Single view and the permission together, held as one for unsaved
 * work. A layout that arrives (a link, Back) never puts a limited viewer in Split view.
 */
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { memoryLocation, memoryStorage } from "../packages/core/src/ports";
import { createUrlSync } from "../packages/core/src/url";
import { setCanInvestigate } from "../packages/core/src/actions/page";
import type { UiStore } from "../packages/core/src/state/store";
import { createTestStore } from "./workspace";

const area = { width: 1156, height: 644 };
let store: UiStore;
beforeEach(() => {
  localStorage.clear();
});

const page = () => store.get().page!;
const downgrade = () => store.apply((x) => setCanInvestigate(x, false));

describe("setCanInvestigate(false) from Split view", () => {
  beforeEach(() => {
    store = createTestStore({ initial: { area } });
    store.actions.openPage({ item: 4, tab: "application" });
    store.actions.setMode("split");
    store.actions.focus("application");
    // Single view shows Application only: Borrower's work would go.
    store.actions.setUnsaved("borrower", "a note");
  });

  it("is held whole for unsaved work: Keep editing leaves the mode and the permission", () => {
    expect(downgrade().reason).toBe("unsaved");
    expect(page()).toMatchObject({ mode: "split", canInvestigate: true });
    store.actions.keepEditing();
    expect(page()).toMatchObject({ mode: "split", canInvestigate: true });
  });

  it("is made whole on Discard: Single view and the limited permission", () => {
    expect(downgrade().reason).toBe("unsaved");
    store.actions.discardAndContinue();
    expect(page()).toMatchObject({ mode: "single", canInvestigate: false });
    expect(store.get().unsaved).toEqual({});
  });

  it("without unsaved work, is one change, said once", () => {
    store.actions.setUnsaved("borrower", null);
    const seq = store.get().announcement.seq;
    expect(downgrade().ok).toBe(true);
    expect(page()).toMatchObject({ mode: "single", canInvestigate: false });
    expect(store.get().announcement.seq).toBe(seq + 1);
  });
});

describe("a limited viewer and a layout that arrives", () => {
  it("Back to an address with opened panes stays in Single view", () => {
    const location = memoryLocation();
    const url = createUrlSync({ location, storage: memoryStorage() });
    store = createTestStore({ url, storage: memoryStorage(), initial: { area } });
    const stop = store.start();
    store.actions.openPage({ item: 4, tab: "application" });
    store.actions.setMode("split");
    store.actions.openBeside("application", {
      kind: "review-record",
      params: { table: "members", id: 150 },
    });
    const investigating = location.search();
    expect(investigating).toContain("open");
    expect(downgrade().ok).toBe(true);
    location.visit(investigating);
    expect(page()).toMatchObject({ mode: "single", canInvestigate: false });
    expect(store.model().panes.every((p) => p.role)).toBe(true);
    stop();
  });
});
