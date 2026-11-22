/**
 * Settings' pane cap is typed, not applied per keystroke (react-opus REACT-6): "12" doesn't pass through a cap of 2,
 * nothing changes until the person leaves the field or presses Enter, and the value is clamped to 2–16 then.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane } from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

afterEach(cleanup);

const note = definePane("note", { title: () => "Note", Component: () => null });

/** Typing: the field's value, with an input event that says a character was typed (as a browser's does). */
function type(input: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  set.call(input, value);
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
}

function open() {
  const jali = createJali({
    panes: [note],
    layout: pane(note({}), { id: "a" }),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });
  const r = render(<JaliRoot jali={jali} />);
  act(() => void jali.dialogs.openSettings());
  const input = r.getByRole("spinbutton") as HTMLInputElement;
  return { jali, input };
}

describe("the pane cap field", () => {
  it("keeps what is typed as a draft, and applies it on blur", () => {
    const { jali, input } = open();
    const before = jali.get().settings.paneCap;
    act(() => type(input, "1"));
    expect(jali.get().settings.paneCap).toBe(before);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    act(() => type(input, "12"));
    expect(jali.get().settings.paneCap).toBe(before);
    expect(input.value).toBe("12");
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    act(() => void fireEvent.blur(input));
    expect(jali.get().settings.paneCap).toBe(12);
  });

  it("applies on Enter, clamped", () => {
    const { jali, input } = open();
    act(() => type(input, "40"));
    act(() => void fireEvent.keyDown(input, { key: "Enter" }));
    expect(jali.get().settings.paneCap).toBe(16);
    expect(input.value).toBe("16");
  });

  it("an emptied field goes back to the cap it had", () => {
    const { jali, input } = open();
    const before = jali.get().settings.paneCap;
    act(() => type(input, ""));
    act(() => void fireEvent.blur(input));
    expect(jali.get().settings.paneCap).toBe(before);
    expect(input.value).toBe(String(before));
  });
});
