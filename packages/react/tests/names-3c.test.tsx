/**
 * API phase 3c: the last names and words. The phone fallback is "one pane at a time", never "Single view" (that is a
 * curated page's mode, and the page always says "Single view" in full); "workspace" is in no public name or word.
 * Each old name an options object could still pass warns in development, naming the new one.
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createJali, en, memoryStorage, row, type JaliOptions } from "@jali/core";
import { definePane } from "@jali/react";

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

afterEach(() => vi.restoreAllMocks());

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
      en.announcements.permission("loan officer", false),
      en.announcements.singleOnly,
      en.announcements.singleNoLayout,
      en.commands.viewAsLimited("loan officer"),
      en.page.single,
      en.page.splitTipLimited,
      en.settings.viewerLimited("loan officer"),
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
