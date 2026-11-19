/** A pane's unsaved work is the content's: it is cleared when the content unmounts, so a kind need not (finding 17). */
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { cleanup, render } from "@testing-library/react";
import { createJali, memoryLocation, memoryStorage, pane } from "@jali/core";
import { JaliRoot, definePane, useUnsaved } from "@jali/react";

function Draft() {
  useUnsaved("a draft");
  return <p>draft</p>;
}
const draft = definePane("draft", { title: "Draft", Component: Draft });

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

describe("useUnsaved", () => {
  it("clears the pane's unsaved work when the content unmounts", () => {
    const jali = createJali({
      panes: [draft],
      layout: pane(draft(), { id: "a" }),
      url: { location: memoryLocation() },
      storage: memoryStorage(),
      size: { width: 800, height: 600 },
      moveFocus: false,
    });
    const { unmount } = render(<JaliRoot jali={jali} />);
    expect(jali.get().unsaved).toEqual({ a: "a draft" });
    unmount();
    expect(jali.get().unsaved).toEqual({});
  });
});
