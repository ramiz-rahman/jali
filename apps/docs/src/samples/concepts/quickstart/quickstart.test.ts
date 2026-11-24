/**
 * The Quickstart's walkthrough, as a test: what its steps tell the reader to click, and what they say happens.
 * Not shown on the site.
 */
import { describe, expect, it } from "vitest";
import { createTestJali } from "jali/testing";
import { note } from "./note-open-beside";

const start = () => createTestJali({ panes: [note], layout: note({ id: 1 }) }).jali;
const notes = (jali: ReturnType<typeof start>) => jali.model().panes.map((p) => p.ref.params.id);
const paneOf = (jali: ReturnType<typeof start>, id: number) =>
  jali.model().panes.find((p) => p.ref.params.id === id)!.id;

describe("the Quickstart", () => {
  it("starts with note 1", () => {
    expect(notes(start())).toEqual([1]);
  });

  it("opens note 2 beside note 1 from note 1's button, and focus stays in note 1", () => {
    const jali = start();
    const one = paneOf(jali, 1);
    jali.actions.focus(one);
    expect(jali.actions.openBeside(one, note({ id: 2 })).ok).toBe(true);
    expect(notes(jali)).toEqual([1, 2]);
    expect(jali.get().view.focused).toBe(one);
  });

  it("keeps opening the next note beside the newest", () => {
    const jali = start();
    for (let id = 2; id <= 5; id++)
      expect(jali.actions.openBeside(paneOf(jali, id - 1), note({ id })).ok).toBe(true);
    expect(notes(jali)).toEqual([1, 2, 3, 4, 5]);
  });

  it("never opens a note twice: note 1's button again shows the note 2 it opened", () => {
    const jali = start();
    const one = paneOf(jali, 1);
    jali.actions.openBeside(one, note({ id: 2 }));
    const again = jali.actions.openBeside(one, note({ id: 2 }));
    expect(again).toEqual({ ok: true, pane: paneOf(jali, 2) });
    expect(notes(jali)).toEqual([1, 2]);
  });
});
