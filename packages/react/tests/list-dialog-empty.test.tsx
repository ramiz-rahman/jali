/**
 * The palette with nothing found (react-opus REACT-8): the listbox holds options only, so the empty state is a status
 * beside it, and the combobox says it filters a list.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane } from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";

afterEach(cleanup);

const note = definePane("note", { title: () => "Note", Component: () => null });

describe("an empty ⌘K list", () => {
  it("has no list item in the listbox, and says so in a status", () => {
    const jali = createJali({
      panes: [note],
      layout: pane(note({}), { id: "a" }),
      url: { location: memoryLocation() },
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
    });
    const { getByRole } = render(<JaliRoot jali={jali} />);
    act(() => void jali.actions.openPalette());
    const input = getByRole("combobox");
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
    fireEvent.change(input, { target: { value: "zzzz nothing" } });
    const list = getByRole("listbox");
    expect(list.children.length).toBe(0);
    const status = [...document.querySelectorAll('[role="status"]')].find((s) =>
      s.textContent?.includes("zzzz"),
    );
    expect(status).toBeDefined();
    expect(list.contains(status!)).toBe(false);
  });
});
