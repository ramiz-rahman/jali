/**
 * The peek sheet's title: its own content's useTitle, else that of a pane showing the same object, else the kind's.
 */
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { useEffect } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import { JaliRoot, JaliView, definePane, useTitle } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

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
        if (!this.classList.contains("jali-layout")) return 0;
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

/** A call: in a pane its content names it from the layout's data; in the sheet, as "DISA — <id>". */
const call = definePane("call", {
  params: { id: String },
  title: ({ id }) => `Call ${id}`,
  Component: ({ params, inPeek, node }) => {
    useTitle(
      params.id === "quiet" ? undefined : inPeek ? `DISA — ${params.id}` : `Pane ${node.id}`,
    );
    return <p>call {params.id}</p>;
  },
});

const peekTitle = () => document.querySelector('[data-testid="peek"] h2')?.textContent;

describe("the peek sheet's title", () => {
  it("is the name a pane showing the same object gave it, else the kind's title", () => {
    const jali = createJali({
      panes: [person],
      layout: row(pane(person({ id: "7" }), { id: "a" }), pane(person({ id: "8" }), { id: "b" })),
      features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
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

  it("is its own content's useTitle first, for the object it shows, and goes when the sheet closes", () => {
    const jali = createJali({
      panes: [person, call],
      layout: row(pane(person({ id: "1" }), { id: "a" }), pane(call({ id: "c1" }), { id: "c" })),
      features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
      storage: memoryStorage(),
      size: { width: 1200, height: 600 },
      moveFocus: false,
    });
    render(
      <JaliRoot jali={jali}>
        <JaliView />
      </JaliRoot>,
    );
    // Not in the layout: only the sheet's own content can name it.
    act(() => void jali.actions.peek("a", call({ id: "c2" })));
    expect(peekTitle()).toBe("DISA — c2");
    // Its own name wins over the pane's showing the same object.
    act(() => void jali.actions.peek("a", call({ id: "c1" })));
    expect(peekTitle()).toBe("DISA — c1");
    // Another object, whose content gives no name: the kind's title, never the last object's name.
    act(() => void jali.actions.peek("a", call({ id: "quiet" })));
    expect(peekTitle()).toBe("Call quiet");
    act(() => void jali.actions.closePeek());
    act(() => void jali.actions.peek("a", call({ id: "c2" })));
    expect(peekTitle()).toBe("DISA — c2");
  });
});

describe("the object the peek sheet shows", () => {
  let mounts = 0;
  /** A pair: its content names it when `a` is "1", and counts each time it mounts in the sheet. */
  const pair = definePane("pair", {
    params: { a: String, b: String },
    title: ({ a, b }) => `Pair ${a}-${b}`,
    Component: ({ params, inPeek }) => {
      useEffect(() => void (inPeek && mounts++), [inPeek]);
      useTitle(params.a === "1" ? `Own ${params.a}-${params.b}` : undefined);
      return <p>pair {params.a}</p>;
    },
  });
  const make = () => {
    mounts = 0;
    const jali = createJali({
      panes: [pair],
      layout: row(pane(pair({ a: "0", b: "0" }), { id: "a" })),
      features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
      storage: memoryStorage(),
      size: { width: 1200, height: 600 },
      moveFocus: false,
    });
    render(
      <JaliRoot jali={jali}>
        <JaliView />
      </JaliRoot>,
    );
    return jali;
  };
  const peekAt = (jali: ReturnType<typeof make>, params: Record<string, string>) =>
    act(() => void jali.actions.peek("a", { kind: "pair", params } as ReturnType<typeof pair>));

  it("is the same with its params in another order: the content stays mounted and keeps its title", () => {
    const jali = make();
    peekAt(jali, { a: "1", b: "2" });
    expect(mounts).toBe(1);
    expect(peekTitle()).toBe("Own 1-2");
    peekAt(jali, { b: "2", a: "1" });
    expect(jali.get().view.peek?.params).toEqual({ b: "2", a: "1" });
    expect(mounts).toBe(1);
    expect(peekTitle()).toBe("Own 1-2");
  });

  it("is another when a param differs: the content mounts again and the last object's title goes", () => {
    const jali = make();
    peekAt(jali, { a: "1", b: "2" });
    peekAt(jali, { a: "1", b: "3" });
    expect(mounts).toBe(2);
    expect(peekTitle()).toBe("Own 1-3");
    peekAt(jali, { a: "4", b: "3" });
    expect(mounts).toBe(3);
    expect(peekTitle()).toBe("Pair 4-3");
  });
});
