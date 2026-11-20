/** The peek sheet names its object as a pane showing the same object does: the title from useTitle, else the kind's. */
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { act, cleanup, render } from "@testing-library/react";
import { createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import { JaliRoot, JaliView, definePane, useTitle } from "@jali/react";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  for (const prop of ["clientWidth", "clientHeight"] as const)
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get(this: HTMLElement) {
        if (!this.classList.contains("jali-workspace")) return 0;
        return prop === "clientWidth" ? 1200 : 600;
      },
    });
});
afterEach(cleanup);

/** A person's card: its kind can only say the id; the content knows the name. */
const person = definePane("person", {
  params: { id: String },
  title: ({ id }) => `Person ${id}`,
  Component: ({ params }) => {
    useTitle(params.id === "7" ? "Ada Lovelace" : undefined);
    return <p>person {params.id}</p>;
  },
});

const peekTitle = () => document.querySelector('[data-testid="peek"] h2')?.textContent;

describe("the peek sheet's title", () => {
  it("is the name a pane showing the same object gave it, else the kind's title", () => {
    const jali = createJali({
      panes: [person],
      layout: row(pane(person({ id: "7" }), { id: "a" }), pane(person({ id: "8" }), { id: "b" })),
      url: { location: memoryLocation() },
      storage: memoryStorage(),
      size: { width: 1200, height: 600 },
      moveFocus: false,
    });
    render(
      <JaliRoot jali={jali}>
        <JaliView />
      </JaliRoot>,
    );
    act(() => void jali.actions.peek("b", person({ id: "7" })));
    expect(peekTitle()).toBe("Ada Lovelace");
    act(() => void jali.actions.peek("a", person({ id: "9" })));
    expect(peekTitle()).toBe("Person 9");
  });
});
