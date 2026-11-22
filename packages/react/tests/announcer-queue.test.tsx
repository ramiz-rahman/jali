/**
 * The live region keeps every message (react-codex REACT-14): two said in one go are both read, a repeat is read
 * again, and one said before the region mounted is still read.
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { JaliRoot, definePane } from "@jali/react";

beforeEach(() => void vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const note = definePane("note", { title: () => "Note", Component: () => null });
const make = () =>
  createJali({
    panes: [note],
    layout: pane(note({}), { id: "a" }),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });
const region = () => document.querySelector('[data-testid="announcer"]')!.textContent;

describe("the live region", () => {
  it("reads two messages said in one go", () => {
    const jali = make();
    render(<JaliRoot jali={jali} />);
    act(() => {
      storeOf(jali).announce("Pane closed");
      storeOf(jali).announce("Focus on Orders");
    });
    act(() => void vi.advanceTimersByTime(50));
    expect(region()).toContain("Pane closed");
    expect(region()).toContain("Focus on Orders");
  });

  it("reads a repeat again, and a message from before it mounted", () => {
    const jali = make();
    storeOf(jali).announce("Before");
    render(<JaliRoot jali={jali} />);
    act(() => void vi.advanceTimersByTime(50));
    expect(region()).toBe("Before");
    act(() => storeOf(jali).announce("Before"));
    expect(region()).toBe("");
    act(() => void vi.advanceTimersByTime(50));
    expect(region()).toBe("Before");
  });
});
