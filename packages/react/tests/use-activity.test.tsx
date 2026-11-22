/** useActivity: a value shows, `undefined` clears it as `"idle"` does, and so does unmounting. */
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { useState } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import type { LayoutInput } from "@jali/core";
import { JaliRoot, JaliView, Shelf, definePane, useActivity } from "@jali/react";

let room = { width: 1200, height: 600 };
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  // jsdom lays nothing out: the workspace measures the room the test asks for.
  for (const prop of ["clientWidth", "clientHeight"] as const)
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get(this: HTMLElement) {
        if (!this.classList.contains("jali-layout")) return 0;
        return prop === "clientWidth" ? room.width : room.height;
      },
    });
});
afterEach(() => {
  cleanup();
  room = { width: 1200, height: 600 };
});

let setReport: (a: "loading" | undefined) => void = () => {};
const busy = definePane("busy", {
  params: {},
  title: () => "Busy",
  Component: () => {
    const [report, set] = useState<"loading" | undefined>("loading");
    setReport = set;
    useActivity(report);
    return <p>busy</p>;
  },
});

const dots = () => document.querySelectorAll(".jali-activity-loading").length;

describe("useActivity", () => {
  it("clears the activity when given undefined, and when the pane's content unmounts", () => {
    const jali = createJali({
      panes: [busy],
      layout: row(pane(busy({}), { id: "a" })),
      storage: memoryStorage(),
      size: { width: 1200, height: 600 },
      moveFocus: false,
    });
    render(
      <JaliRoot jali={jali}>
        <JaliView />
      </JaliRoot>,
    );
    expect(dots()).toBeGreaterThan(0);
    act(() => setReport(undefined));
    expect(dots()).toBe(0);
  });
});
