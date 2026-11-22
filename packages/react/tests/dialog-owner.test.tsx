/**
 * Jali's dialogs have one owner (react-codex REACT-5): Settings asked for where the root renders none closes again (so
 * keys keep working), one dialog shows at a time (the chooser over Settings), and Tab wraps past a hidden control.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, type Feature } from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";
import { defaultFeatures, noUrl, urlSync } from "./features";

afterEach(cleanup);

const note = definePane("note", { title: () => "Note", Component: () => null });
const make = (options: { features?: Feature[] } = {}) =>
  createJali({
    panes: [note],
    layout: pane(note({}), { id: "a" }),
    features: options.features ?? [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });
const modals = () => document.querySelectorAll('[aria-modal="true"]').length;

describe("one owner for Jali's dialogs", () => {
  it("without the settings feature, openSettings leaves nothing open", () => {
    const jali = make({ features: noUrl().filter((f) => f.id !== "settings") });
    render(<JaliRoot jali={jali} />);
    act(() => void jali.dialogs.openSettings());
    expect(jali.get().settingsOpen).toBe(false);
    expect(modals()).toBe(0);
  });

  it("shows one modal at a time: the chooser over Settings, and Settings again after", () => {
    const jali = make();
    render(<JaliRoot jali={jali} />);
    act(() => void jali.dialogs.openSettings());
    act(
      () =>
        void jali.dialogs.choose({
          title: "Pick",
          items: ["x"],
          label: String,
          onChoose: () => {},
        }),
    );
    expect(modals()).toBe(1);
    expect(document.querySelector('[aria-modal="true"]')!.getAttribute("data-dialog")).toBe(
      "chooser",
    );
    act(() => void fireEvent.keyDown(document.activeElement!, { key: "Escape" }));
    expect(modals()).toBe(1);
    expect(document.querySelector('[aria-modal="true"]')!.getAttribute("data-dialog")).toBe(
      "settings",
    );
  });

  it("Tab wraps from the last visible control past a hidden one", () => {
    const jali = make();
    render(
      <JaliRoot
        jali={jali}
        settingsExtra={
          <fieldset>
            <legend>Mine</legend>
            <button type="button">Last</button>
            <button type="button" hidden>
              Hidden
            </button>
          </fieldset>
        }
      />,
    );
    act(() => void jali.dialogs.openSettings());
    const last = [...document.querySelectorAll("button")].find((b) => b.textContent === "Last")!;
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    const dialog = document.querySelector('[aria-modal="true"]')!;
    expect(document.activeElement).not.toBe(last);
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect((document.activeElement as HTMLElement).textContent).not.toBe("Hidden");
  });
});
