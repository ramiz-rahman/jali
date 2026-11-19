/**
 * A pane that throws or suspends stays inside its own boundaries (PaneBoundary.tsx), and a pane names itself from
 * its data with useTitle.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { storeOf } from "@jali/core/adapter";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Suspense, use, useState } from "react";
import { createJali, listCommands, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import type { LayoutInput, PaneErrorInfo } from "@jali/core";
import { JaliRoot, definePane, useTitle, type Pane } from "@jali/react";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
// React reports caught errors on the console; the tests check `onPaneError` instead.
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <p>note body {params.id}</p>,
});

function make(
  panes: Pane[],
  layout: LayoutInput,
  onPaneError?: (error: unknown, info: PaneErrorInfo) => void,
) {
  return createJali({
    panes,
    layout,
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 600 },
    moveFocus: false,
    ...(onPaneError ? { onPaneError } : {}),
  });
}

describe("a pane that throws", () => {
  let failing = true;
  let mounts = 0;
  const order = definePane("order", {
    params: { id: Number },
    title: ({ id }) => `Order ${id}`,
    Component: ({ params }) => {
      useState(() => mounts++);
      if (failing && params.id === 1) throw new Error("Order service is down");
      return <p>order body {params.id}</p>;
    },
  });
  beforeEach(() => {
    failing = true;
    mounts = 0;
  });

  it("shows a failed state, leaves the other panes rendered and reports the error", () => {
    const onPaneError = vi.fn();
    const jali = make(
      [note, order],
      row(pane(note({ id: 1 }), { id: "a" }), pane(order({ id: 1 }), { id: "b" })),
      onPaneError,
    );
    render(<JaliRoot jali={jali} />);
    expect(screen.getByText("note body 1")).toBeTruthy();
    expect(screen.getByRole("alert", { hidden: true }).textContent).toContain(
      "Order 1 could not be shown.",
    );
    expect(screen.getByText("Order service is down")).toBeTruthy();
    expect(jali.get().activity.b).toBe("error");
    expect(jali.model().panes.map((p) => p.id)).toEqual(["a", "b"]);
    expect(onPaneError).toHaveBeenCalledTimes(1);
    expect(onPaneError.mock.calls[0]![0]).toBeInstanceOf(Error);
    expect(onPaneError.mock.calls[0]![1]).toEqual({ pane: "b", ref: order({ id: 1 }) });
  });

  it("Retry mounts the content again", () => {
    const jali = make([order], pane(order({ id: 1 }), { id: "b" }), () => {});
    render(<JaliRoot jali={jali} />);
    const before = mounts;
    failing = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("order body 1")).toBeTruthy();
    expect(mounts).toBeGreaterThan(before);
    expect(jali.get().activity.b).toBe("idle");
  });

  it("lists Retry in ⌘K for the focused failed pane, and it works", () => {
    const jali = make([order], pane(order({ id: 1 }), { id: "b" }), () => {});
    render(<JaliRoot jali={jali} />);
    act(() => jali.actions.focus("b"));
    const retry = listCommands(jali).find((c) => c.key === "pane:retry");
    expect(retry).toMatchObject({ title: "Retry", group: "Order 1", disabled: false });
    failing = false;
    act(() => retry!.run());
    expect(screen.getByText("order body 1")).toBeTruthy();
    expect(listCommands(jali).some((c) => c.key === "pane:retry")).toBe(false);
  });

  it("Close closes the pane", () => {
    const jali = make(
      [note, order],
      row(pane(note({ id: 1 }), { id: "a" }), pane(order({ id: 1 }), { id: "b" })),
      () => {},
    );
    render(<JaliRoot jali={jali} />);
    fireEvent.click(screen.getByRole("button", { name: "Close", hidden: true }));
    expect(jali.model().panes.map((p) => p.id)).toEqual(["a"]);
  });

  it("showing another object clears the failure", () => {
    const jali = make([order], pane(order({ id: 1 }), { id: "b" }), () => {});
    render(<JaliRoot jali={jali} />);
    expect(screen.getByRole("alert", { hidden: true })).toBeTruthy();
    act(() => jali.actions.openHere("b", order({ id: 2 })));
    expect(screen.getByText("order body 2")).toBeTruthy();
    expect(screen.queryByRole("alert", { hidden: true })).toBeNull();
  });
});

describe("a pane that suspends", () => {
  // React 19: a render that suspends must be inside an awaited act().
  function deferred() {
    let resolve!: (v: string) => void;
    const promise = new Promise<string>((r) => (resolve = r));
    return { promise, resolve };
  }

  it("shows the default loading state, then its content", async () => {
    const d = deferred();
    const report = definePane("report", {
      title: "Report",
      Component: () => <p>{use(d.promise)}</p>,
    });
    const jali = make(
      [note, report],
      row(pane(note({ id: 1 }), { id: "a" }), pane(report(), { id: "r" })),
    );
    await act(async () => render(<JaliRoot jali={jali} />));
    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(screen.getByText("note body 1")).toBeTruthy();
    expect(jali.get().activity.r).toBe("loading");
    await act(async () => d.resolve("report ready"));
    expect(screen.getByText("report ready")).toBeTruthy();
    expect(screen.queryByText("Loading…")).toBeNull();
    expect(jali.get().activity.r).toBe("idle");
  });

  it("shows the kind's own Loading, with the pane's props", async () => {
    const d = deferred();
    const report = definePane("report", {
      params: { id: Number },
      title: ({ id }) => `Report ${id}`,
      Loading: ({ params }) => <p>Fetching report {params.id}</p>,
      Component: () => <p>{use(d.promise)}</p>,
    });
    const jali = make([report], pane(report({ id: 4 }), { id: "r" }));
    await act(async () => render(<JaliRoot jali={jali} />));
    expect(screen.getByText("Fetching report 4")).toBeTruthy();
    await act(async () => d.resolve("report ready"));
    expect(screen.getByText("report ready")).toBeTruthy();
  });

  it("never reaches a Suspense boundary of the host", async () => {
    const report = definePane("report", {
      title: "Report",
      Component: () => <p>{use(new Promise<string>(() => {}))}</p>,
    });
    const jali = make([report], pane(report(), { id: "r" }));
    await act(async () =>
      render(
        <Suspense fallback={<p>host fallback</p>}>
          <JaliRoot jali={jali} />
        </Suspense>,
      ),
    );
    expect(screen.queryByText("host fallback")).toBeNull();
    expect(screen.getByText("Loading…")).toBeTruthy();
  });
});

describe("useTitle", () => {
  const names: Record<number, string> = { 1: "Acme Ltd", 2: "Birch & Co" };
  function Named({ id }: { id: number }) {
    useTitle(names[id]);
    return <p>customer {id}</p>;
  }
  const customer = definePane("customer", {
    params: { id: Number },
    title: ({ id }) => `Customer ${id}`,
    Component: ({ params }) => {
      const [shown, setShown] = useState(true);
      return (
        <>
          {shown ? <Named id={params.id} /> : null}
          <button onClick={() => setShown(false)}>Hide name</button>
        </>
      );
    },
  });

  const heading = () => screen.getByRole("heading", { level: 2 }).textContent;

  it("names the pane in its header and the model", () => {
    const jali = make([customer], pane(customer({ id: 1 }), { id: "c" }));
    render(<JaliRoot jali={jali} />);
    expect(heading()).toBe("Acme Ltd");
    expect(jali.model().title("c")).toBe("Acme Ltd");
    expect(storeOf(jali).get().titles).toEqual({ c: "Acme Ltd" });
  });

  it("is cleared when the component unmounts", () => {
    const jali = make([customer], pane(customer({ id: 1 }), { id: "c" }));
    render(<JaliRoot jali={jali} />);
    fireEvent.click(screen.getByRole("button", { name: "Hide name" }));
    expect(heading()).toBe("Customer 1");
    expect(storeOf(jali).get().titles).toEqual({});
  });

  it("follows the object the pane shows", () => {
    const jali = make([customer], pane(customer({ id: 1 }), { id: "c" }));
    render(<JaliRoot jali={jali} />);
    act(() => jali.actions.openHere("c", customer({ id: 2 })));
    expect(heading()).toBe("Birch & Co");
    act(() => jali.actions.openHere("c", customer({ id: 5 })));
    expect(heading()).toBe("Customer 5");
    expect(storeOf(jali).get().titles).toEqual({});
  });

  it("names the pane in announcements and goes with it", () => {
    const jali = make(
      [note, customer],
      row(pane(note({ id: 1 }), { id: "a" }), pane(customer({ id: 1 }), { id: "c" })),
    );
    render(<JaliRoot jali={jali} />);
    act(() => jali.actions.toggleZoom("c"));
    expect(storeOf(jali).get().announcement.text).toContain("Acme Ltd");
    act(() => jali.actions.close("c"));
    expect(storeOf(jali).get().titles).toEqual({});
  });

  it("is ignored by the peek sheet", () => {
    const jali = make([note, customer], pane(note({ id: 1 }), { id: "a" }));
    render(<JaliRoot jali={jali} />);
    act(() => jali.actions.peek("a", customer({ id: 1 })));
    expect(screen.getByTestId("peek").getAttribute("aria-label")).toBe("Peek: Customer 1");
    expect(storeOf(jali).get().titles).toEqual({});
  });
});
