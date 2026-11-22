/**
 * `<IconButton>`: the public icon button, the same part (`.jali-icon-btn`) as Jali's header buttons, for the app's own
 * chrome (Markets, Data Studio and Loan review FINDINGS.md).
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage } from "@jali/core";
import { IconButton, JaliRoot, JaliView, definePane } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

afterEach(cleanup);

describe("IconButton", () => {
  it("is a button named by its label, with the label as its tooltip", () => {
    const { getByRole } = render(
      <IconButton label="Copy link" onClick={() => {}}>
        <svg aria-hidden />
      </IconButton>,
    );
    const button = getByRole("button", { name: "Copy link" });
    expect(button.className).toBe("jali-icon-btn");
    expect(button.getAttribute("type")).toBe("button");
    expect(button.getAttribute("title")).toBe("Copy link");
  });

  it("takes a title, a class, a ref and the button's own props", () => {
    const ref = createRef<HTMLButtonElement>();
    const click = vi.fn();
    const { getByRole } = render(
      <IconButton
        ref={ref}
        label="Use the dark theme"
        title="Dark theme"
        className="theme"
        aria-pressed={false}
        onClick={click}
      >
        <svg aria-hidden />
      </IconButton>,
    );
    const button = getByRole("button", { name: "Use the dark theme" });
    expect(ref.current).toBe(button);
    expect(button.className).toBe("jali-icon-btn theme");
    expect(button.getAttribute("title")).toBe("Dark theme");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("is held down like Jali's own controls (data-pressed) inside a workspace", () => {
    const notes = definePane("notes", { title: "Notes", Component: () => null });
    const jali = createJali({
      panes: [notes],
      layout: notes(),
      features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
      storage: memoryStorage(),
      size: { width: 800, height: 600 },
      moveFocus: false,
    });
    const { getByRole } = render(
      <JaliRoot jali={jali}>
        <div data-jali-chrome>
          <IconButton label="Settings">
            <svg aria-hidden />
          </IconButton>
        </div>
        <JaliView />
      </JaliRoot>,
    );
    const button = getByRole("button", { name: "Settings" });
    fireEvent.pointerDown(button, { button: 0, isPrimary: true });
    expect(button.hasAttribute("data-pressed")).toBe(true);
    fireEvent.pointerUp(button);
    expect(button.hasAttribute("data-pressed")).toBe(false);
  });
});
