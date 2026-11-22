/** A folded pane goes on working: the "N folded" chip says so, and its menu marks the pane that is. */
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { act, cleanup, render } from "@testing-library/react";
import { createJali, memoryLocation, memoryStorage, optional, pane, row } from "@jali/core";
import type { PaneActivity } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { JaliRoot, JaliView, definePane, useActivity } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

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
        if (!this.classList.contains("jali-workspace")) return 0;
        return prop === "clientWidth" ? room.width : room.height;
      },
    });
});
afterEach(() => {
  cleanup();
  room = { width: 1200, height: 600 };
});

const job = definePane("job", {
  params: { busy: Boolean },
  title: ({ busy }) => (busy ? "Busy job" : "Quiet job"),
  Component: ({ params }) => {
    useActivity(params.busy ? "working" : undefined);
    return <p>job</p>;
  },
});

/** A job that reports the activity its link names. */
const task = definePane("task", {
  params: { does: optional(String) },
  title: ({ does }) => `Task ${does ?? "idle"}`,
  Component: ({ params }) => {
    useActivity(params.does as PaneActivity | undefined);
    return <p>task</p>;
  },
});

const make = (busy: boolean | (PaneActivity | undefined)[]) => {
  const jali = createJali({
    panes: [job, task],
    layout: Array.isArray(busy)
      ? row(...busy.map((does, i) => pane(task(does ? { does } : {}), { id: `t${i}` })))
      : row(pane(job({ busy }), { id: "a" }), pane(job({ busy }), { id: "b" })),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1200, height: 600 },
    moveFocus: false,
    // Folding at 360px is what this looks at; below the phone width it would be Single view.
    phone: { below: 0 },
  });
  render(
    <JaliRoot jali={jali}>
      <JaliView />
    </JaliRoot>,
  );
  room = { width: 360, height: 600 };
  act(() => storeOf(jali).set({ area: { width: 360, height: 600 } }));
  const chip = document.querySelector<HTMLElement>(".jali-tab-folded")!;
  expect(chip).toBeTruthy();
  return chip;
};

describe("a folded pane's activity", () => {
  it("shows on the folded chip, in its name, and on the pane's entry in its menu", () => {
    const chip = make(true);
    expect(chip.dataset.activity).toBe("working");
    expect(chip.getAttribute("aria-label")).toMatch(/1 folded pane, working/);
    const shape = chip.querySelector<HTMLElement>(".jali-activity-shape")!;
    expect(shape.dataset.activity).toBe("working");
    expect(shape.dataset.shape).toBe("ring");
    act(() => chip.click());
    const item = document.querySelector<HTMLElement>('[role="menuitem"][data-item]')!;
    expect(item.querySelector<HTMLElement>(".jali-activity")!.dataset.activity).toBe("working");
  });

  it("live work shows a dot, not the ring, and reads as live", () => {
    const chip = make(["live", "live"]);
    expect(chip.dataset.activity).toBe("live");
    expect(chip.getAttribute("aria-label")).toMatch(/1 folded pane, live/);
    const shape = chip.querySelector<HTMLElement>(".jali-activity-shape")!;
    expect(shape.dataset.activity).toBe("live");
    expect(shape.dataset.shape).toBe("dot");
    act(() => chip.click());
    const dot = document.querySelector<HTMLElement>('[role="menuitem"][data-item] .jali-activity')!;
    expect(dot.dataset.activity).toBe("live");
    expect(dot.getAttribute("aria-label")).toBe("Live");
  });

  it("live is the least pressing: a working pane behind the chip says so first", () => {
    const chip = make([undefined, "live", "working"]);
    expect(chip.dataset.activity).toBe("working");
    expect(chip.getAttribute("aria-label")).toMatch(/2 folded panes, working/);
  });

  it("shows nothing for folded panes that are idle", () => {
    const chip = make(false);
    expect(chip.dataset.activity).toBeUndefined();
    expect(chip.getAttribute("aria-label")).toBe("1 folded pane");
    expect(chip.querySelector(".jali-activity-shape")).toBeNull();
    act(() => chip.click());
    expect(document.querySelector('[role="menuitem"] .jali-activity')).toBeNull();
  });
});
