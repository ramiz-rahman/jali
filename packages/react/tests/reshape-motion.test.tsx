/**
 * The reshape slide ends (react-codex REACT-8): the workspace holds `is-reshaping` (which hides the dividers) only
 * while the slide plays, after one reshape and after two in a row.
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { JaliRoot, definePane } from "@jali/react";

beforeEach(() => void vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: () => null,
});

describe("the reshape slide", () => {
  it("ends after one reshape, and after two in a row", () => {
    const jali = createJali({
      panes: [note],
      layout: row(...[1, 2, 3, 4].map((id) => pane(note({ id }), { id: `n${id}` }))),
      url: { location: memoryLocation() },
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
    });
    render(<JaliRoot jali={jali} />);
    const ws = () => document.querySelector(".jali-workspace")!;
    const reshape = () =>
      act(() => storeOf(jali).set({ reshapes: storeOf(jali).get().reshapes + 1 }));
    reshape();
    expect(ws().classList.contains("is-reshaping")).toBe(true);
    act(() => void vi.advanceTimersByTime(300));
    expect(ws().classList.contains("is-reshaping")).toBe(false);
    reshape();
    act(() => void vi.advanceTimersByTime(100));
    reshape();
    act(() => void vi.advanceTimersByTime(300));
    expect(ws().classList.contains("is-reshaping")).toBe(false);
  });
});
