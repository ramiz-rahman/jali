import { describe, expect, it } from "vite-plus/test";
import { keyBelongsToContent } from "@jali/react";

const keyOn = (html: string, selector: string) => {
  document.body.innerHTML = html;
  const el = document.querySelector(selector)!;
  const event = new KeyboardEvent("keydown", { key: " ", bubbles: true });
  el.dispatchEvent(event);
  return keyBelongsToContent(
    Object.defineProperty(new KeyboardEvent("keydown", { key: " " }), "target", { value: el }),
  );
};

describe("keyBelongsToContent", () => {
  it("is true for text fields, editable regions, comboboxes, dialogs and controls Space presses", () => {
    expect(keyOn("<input>", "input")).toBe(true);
    expect(keyOn("<textarea></textarea>", "textarea")).toBe(true);
    expect(keyOn('<div contenteditable="true"><b>x</b></div>', "b")).toBe(true);
    expect(keyOn('<div role="combobox"></div>', "div")).toBe(true);
    expect(keyOn('<div role="alertdialog"><p>sure?</p></div>', "p")).toBe(true);
    expect(keyOn("<button>Keep</button>", "button")).toBe(true);
    expect(keyOn('<div role="tab">One</div>', "div")).toBe(true);
  });
  it("is false for plain content, sliders and a missing target", () => {
    expect(keyOn("<div><p>list row</p></div>", "p")).toBe(false);
    expect(keyOn('<input type="range">', "input")).toBe(false);
    expect(keyBelongsToContent(new KeyboardEvent("keydown", { key: " " }))).toBe(false);
  });
});
