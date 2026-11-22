/**
 * The Quickstart's walkthrough, as a test: what its steps tell the reader to click, and what they say happens.
 * Not shown on the site.
 */
import { describe, expect, it } from "vitest";
import { row } from "jali";
import { createTestJali } from "jali/testing";
import { note } from "./note-open-beside";

const start = () =>
  createTestJali({ panes: [note], layout: row(note({ id: 1 }), note({ id: 2 })) }).jali;
const notes = (jali: ReturnType<typeof start>) =>
  jali.model().panes.map((p) => p.ref.params.id);

describe("the Quickstart", () => {
  it("starts with notes 1 and 2 side by side", () => {
    expect(notes(start())).toEqual([1, 2]);
  });

  it("opens note 3 beside note 2 from note 2's button, and focus stays in note 2", () => {
    const jali = start();
    const two = jali.model().panes.find((p) => p.ref.params.id === 2)!.id;
    jali.actions.focus(two);
    const opened = jali.actions.openBeside(two, note({ id: 3 }));
    expect(opened.ok).toBe(true);
    expect(notes(jali)).toEqual([1, 2, 3]);
    expect(jali.get().view.focused).toBe(two);
  });

  it("keeps opening the next note beside the newest", () => {
    const jali = start();
    for (let id = 3; id <= 5; id++) {
      const from = jali.model().panes.find((p) => p.ref.params.id === id - 1)!.id;
      expect(jali.actions.openBeside(from, note({ id })).ok).toBe(true);
    }
    expect(notes(jali)).toEqual([1, 2, 3, 4, 5]);
  });
});
