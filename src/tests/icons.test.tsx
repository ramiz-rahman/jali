/** The icon slot: a host's icons replace Jali's by name, the rest stay Phosphor's, and the bare entry wants them all. */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, row } from "@jali/core";
import { JaliRoot, definePane, type JaliIconProps } from "@jali/react";
import { JaliRoot as BareJaliRoot } from "@jali/react/bare";
import { phosphorIcons } from "@jali/react/icons";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <p>Note {params.id}</p>,
});

const make = () =>
  createJali({
    panes: [note],
    layout: row(note({ id: 1 }), note({ id: 2 })),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });

const HostClose = ({ size }: JaliIconProps) => <svg data-testid="host-close" width={size} />;
const isPhosphor = (el: Element | null) => el?.getAttribute("viewBox") === "0 0 256 256";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

describe("icons", () => {
  it("a host's icon replaces one of Jali's in a pane's header; the others stay Phosphor's", () => {
    render(<JaliRoot jali={make()} icons={{ close: HostClose }} />);
    const close = screen.getAllByRole("button", { name: "Close Note 1" })[0]!;
    expect(within(close).getByTestId("host-close")).toBeTruthy();
    const tuck = screen.getAllByRole("button", { name: "Tuck Note 1" })[0]!;
    expect(isPhosphor(tuck.querySelector("svg"))).toBe(true);
    // A kind without an icon gets the default kind icon, Phosphor's square.
    const header = close.closest(".jali-pane-header")!;
    expect([...header.querySelectorAll("svg")].some(isPhosphor)).toBe(true);
  });

  it("with no icons, every icon is Phosphor's", () => {
    render(<JaliRoot jali={make()} />);
    const close = screen.getAllByRole("button", { name: "Close Note 1" })[0]!;
    expect(isPhosphor(close.querySelector("svg"))).toBe(true);
  });

  it("the bare entry draws with exactly the icons it is given", () => {
    render(<BareJaliRoot jali={make()} icons={{ ...phosphorIcons, close: HostClose }} />);
    expect(screen.getAllByTestId("host-close").length).toBeGreaterThan(0);
  });

  it("the bare entry's types refuse an incomplete set", () => {
    const partial = { close: HostClose };
    // @ts-expect-error: @jali/react/bare needs every icon (JaliIcons), not some of them.
    const el = <BareJaliRoot jali={make()} icons={partial} />;
    expect(el).toBeTruthy();
  });
});
