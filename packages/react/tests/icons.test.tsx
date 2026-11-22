/** The icon slot: a host's icons replace Jali's by name, and the rest stay Jali's own. */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, row } from "@jali/core";
import { JaliRoot, definePane, type JaliIconProps } from "@jali/react";
import { defaultIcons } from "@jali/react/icons";
import { defaultFeatures, urlSync } from "./features";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <p>Note {params.id}</p>,
});

const make = () =>
  createJali({
    panes: [note],
    layout: row(note({ id: 1 }), note({ id: 2 })),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });

const HostClose = ({ size }: JaliIconProps) => <svg data-testid="host-close" width={size} />;
const isJali = (el: Element | null) => el?.hasAttribute("data-jali-icon") ?? false;

// jsdom has no layout: the workspace is told its size, so the two notes sit side by side (one pane alone has no
// tuck or maximise).
const size = { clientWidth: 1200, clientHeight: 800 };
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  for (const [k, v] of Object.entries(size))
    Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get: () => v });
});
afterAll(() => {
  for (const k of Object.keys(size))
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
});
afterEach(cleanup);

describe("icons", () => {
  it("a host's icon replaces one of Jali's in a pane's header; the others stay Jali's", () => {
    render(<JaliRoot jali={make()} icons={{ close: HostClose }} />);
    const close = screen.getAllByRole("button", { name: "Close Note 1" })[0]!;
    expect(within(close).getByTestId("host-close")).toBeTruthy();
    const tuck = screen.getAllByRole("button", { name: /^Tuck/ })[0]!;
    expect(isJali(tuck.querySelector("svg"))).toBe(true);
    // A kind without an icon gets the default kind icon, a square.
    const header = close.closest(".jali-pane-header")!;
    expect([...header.querySelectorAll("svg")].some(isJali)).toBe(true);
  });

  it("with no icons, every icon is Jali's own", () => {
    render(<JaliRoot jali={make()} />);
    const close = screen.getAllByRole("button", { name: "Close Note 1" })[0]!;
    expect(isJali(close.querySelector("svg"))).toBe(true);
  });

  it("a host's icon gets the class that sizes it by place, and the place's default size", () => {
    const seen: JaliIconProps[] = [];
    const Spy = (props: JaliIconProps) => {
      seen.push(props);
      return <svg className={props.className} width={props.size} />;
    };
    render(<JaliRoot jali={make()} icons={{ close: Spy, tuck: Spy, defaultKind: Spy }} />);
    // The header's buttons read --jali-icon-header (14px by default); a pane's title icon is 2px larger.
    expect(seen).toContainEqual(
      expect.objectContaining({ className: "jali-icon-header", size: 14 }),
    );
    expect(seen).toContainEqual(
      expect.objectContaining({ className: "jali-icon-header-lg", size: 16 }),
    );
    expect(seen.every((p) => typeof p.className === "string")).toBe(true);
  });

  it("a full set of the host's draws no icon of Jali's", () => {
    const own = Object.fromEntries(Object.keys(defaultIcons).map((k) => [k, HostClose]));
    const { container } = render(<JaliRoot jali={make()} icons={own} />);
    expect(screen.getAllByTestId("host-close").length).toBeGreaterThan(0);
    expect(container.querySelector("[data-jali-icon]")).toBeNull();
  });
});
