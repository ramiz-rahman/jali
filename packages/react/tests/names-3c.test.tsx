/**
 * API phase 3c: the last names and words. The phone fallback is "one pane at a time", never "Single view" (that is a
 * curated page's mode, and the page always says "Single view" in full); "workspace" is in no public name or word.
 * Each old name an options object could still pass warns in development, naming the new one.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createJali, en, memoryStorage, row, type JaliOptions } from "@jali/core";
import { Activity, JaliRoot, JaliView, definePane } from "@jali/react";
import { storeOf } from "@jali/core/adapter";

const note = definePane("note", { params: { id: Number }, title: "Note", Component: () => null });
const warned = () => vi.mocked(console.warn).mock.calls.map((c) => String(c[0]));
const make = (extra: Record<string, unknown>) =>
  createJali({
    panes: [note],
    layout: row(note({ id: 1 })),
    storage: memoryStorage(),
    moveFocus: false,
    ...extra,
  } as JaliOptions);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the phone fallback's words", () => {
  it("say one pane at a time, not Single view", () => {
    expect(en.announcements.onePaneOn).toMatch(/^One pane at a time/);
    expect(en.announcements.onePaneOff).not.toMatch(/single/i);
    expect("singleOn" in en.announcements).toBe(false);
    expect("singleOff" in en.announcements).toBe(false);
  });
});

describe("a curated page's words", () => {
  it('say "Single view" in full', () => {
    const words = [
      en.announcements.modeSingle("Borrower"),
      en.announcements.singleNoLayout,
      en.commands.pageSingle,
      en.page.single,
    ];
    for (const w of words) expect(w, w).toMatch(/Single view/);
    for (const w of words) expect(w.replace(/Single view/g, ""), w).not.toMatch(/Single/);
  });
});

describe("old message names", () => {
  it("warn in development, naming the new one", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    make({
      messages: {
        announcements: { singleOn: "x", singleOff: "y", notInvestigating: "z", closed: () => "" },
        page: { investigation: "a", investigating: () => [] },
        workspace: { label: "Volets" },
      },
    });
    expect(warned()).toEqual([
      'Jali: createJali has no option "messages.announcements.singleOn": moved to messages.announcements.onePaneOn',
      'Jali: createJali has no option "messages.announcements.singleOff": moved to messages.announcements.onePaneOff',
      'Jali: createJali has no option "messages.announcements.notInvestigating": moved to messages.announcements.nothingOpened',
      'Jali: createJali has no option "messages.page.investigation": moved to messages.page.openedLabel',
      'Jali: createJali has no option "messages.page.investigating": moved to messages.page.openedCount',
      'Jali: createJali has no option "messages.workspace": moved to messages.panes',
    ]);
  });
});

describe("two instances with one name", () => {
  it("warn in development without saying workspace", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const a = make({ id: "a", label: "Sales", size: { width: 1200, height: 800 } });
    const b = make({ id: "b", label: "Sales", size: { width: 1200, height: 800 } });
    render(
      <>
        <JaliRoot jali={a}>
          <JaliView />
        </JaliRoot>
        <JaliRoot jali={b}>
          <JaliView />
        </JaliRoot>
      </>,
    );
    expect(warned()).toEqual([
      'Jali: two instances on this page are both named "Sales", so their landmarks repeat. Name each with ' +
        "<JaliRoot aria-label> (or aria-labelledby), or createJali({ label }).",
    ]);
  });
});

describe("one pane at a time, in the model and the DOM", () => {
  it("is model.onePane, and data-one-pane on the element named jali-layout", () => {
    const phone = make({ size: { width: 390, height: 844 } });
    expect(storeOf(phone).model().onePane).toBe(true);
    expect(storeOf(make({ id: "w", size: { width: 1200, height: 800 } })).model().onePane).toBe(
      false,
    );
    expect("single" in phone.model()).toBe(false);
    // jsdom measures nothing: the root is as wide as a phone.
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
    Object.defineProperty(proto, "clientWidth", { configurable: true, get: () => 390 });
    Object.defineProperty(proto, "clientHeight", { configurable: true, get: () => 844 });
    try {
      const { container } = render(
        <JaliRoot jali={phone}>
          <JaliView />
        </JaliRoot>,
      );
      expect(container.querySelector(".jali-layout")!.hasAttribute("data-one-pane")).toBe(true);
      expect(container.querySelector(".jali-workspace, [data-single]")).toBeNull();
    } finally {
      delete proto.clientWidth;
      delete proto.clientHeight;
    }
  });
});

describe("<Activity>", () => {
  it("takes activity, and warns in development about a", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(
      <JaliRoot jali={make({})}>
        <Activity activity="working" />
        <Activity {...({ a: "live" } as unknown as { activity: undefined })} />
      </JaliRoot>,
    );
    expect(container.querySelector("[data-activity=working]")).not.toBeNull();
    expect(warned()).toEqual([
      'Jali: Activity has no prop "a": a is activity (<Activity activity={…} />)',
    ]);
  });
});
