/** A folded pane goes on working: the "N folded" chip says so, and its menu marks the pane that is. */
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { act, cleanup, render } from "@testing-library/react";
import { createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { JaliRoot, JaliView, definePane, useActivity } from "@jali/react";

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

const make = (busy: boolean) => {
  const jali = createJali({
    panes: [job],
    layout: row(pane(job({ busy }), { id: "a" }), pane(job({ busy }), { id: "b" })),
    url: { location: memoryLocation() },
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

  it("shows nothing for folded panes that are idle", () => {
    const chip = make(false);
    expect(chip.dataset.activity).toBeUndefined();
    expect(chip.getAttribute("aria-label")).toBe("1 folded pane");
    expect(chip.querySelector(".jali-activity-shape")).toBeNull();
    act(() => chip.click());
    expect(document.querySelector('[role="menuitem"] .jali-activity')).toBeNull();
  });
});
