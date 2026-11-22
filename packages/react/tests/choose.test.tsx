/**
 * `jali.actions.choose`: a command asks the person for one of the app's items in Jali's chooser ("Open chart for…"),
 * with search, the keyboard and the same screen reader roles as "Add to tabs of…", in the workspace's messages.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  createJali,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  runCommand,
  type Command,
  type Jali,
  type JaliOptions,
} from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { JaliRoot, definePane } from "@jali/react";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

interface Instrument {
  symbol: string;
  name: string;
}
const INSTRUMENTS: Instrument[] = [
  { symbol: "LMNA", name: "Lumina Corp" },
  { symbol: "ORBD", name: "Orbital Dynamics" },
  { symbol: "HLXS", name: "Helix Systems" },
  { symbol: "KSTR", name: "Kestrel Lumber" },
];

const Nothing = () => null;
const watchlist = definePane("watchlist", { title: "Watchlist", Component: Nothing });
const chart = definePane("chart", {
  params: { symbol: String },
  title: ({ symbol }) => `${symbol} chart`,
  Component: Nothing,
});

/** The app's command: asks for an instrument, then opens its chart beside the watchlist. */
const chartFor: Command = {
  id: "markets.chart",
  title: "Open chart for…",
  group: "Markets",
  run: (jali) =>
    jali.dialogs.choose({
      title: "Open chart for…",
      items: INSTRUMENTS,
      label: (i) => i.symbol,
      hint: (i) => i.name,
      onChoose: (i) => jali.actions.openBeside("watch", chart({ symbol: i.symbol })),
    }),
};

const make = (options: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [watchlist, chart],
    layout: row(pane(watchlist(), { id: "watch" })),
    commands: [chartFor],
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1400, height: 700 },
    moveFocus: false,
    ...options,
  });
const charts = (jali: Jali) =>
  jali
    .model()
    .panes.filter((p) => p.ref.kind === "chart")
    .map((p) => p.ref.params.symbol);

describe("choose, headless", () => {
  it("opens the chooser and closes ⌘K", () => {
    const jali = make();
    jali.dialogs.openPalette();
    const onChoose = vi.fn();
    const r = jali.dialogs.choose({ title: "Pick", items: [1, 2], label: String, onChoose });
    expect(r).toEqual({ ok: true });
    expect(jali.get().paletteOpen).toBe(false);
    expect(storeOf(jali).get().chooser).toMatchObject({ kind: "choose" });
  });

  it("refuses options it can't show", () => {
    const jali = make();
    const bad = { title: "", items: [], label: String, onChoose: () => {} };
    expect(jali.dialogs.choose(bad)).toEqual({ ok: false, reason: "invalid" });
    expect(storeOf(jali).get().chooser).toBeNull();
  });
});

describe("choose, in the chooser", () => {
  const open = () => {
    vi.useFakeTimers();
    const jali = make();
    render(<JaliRoot jali={jali} />);
    act(() => {
      runCommand(jali, "markets.chart");
    });
    return jali;
  };

  it("is a dialog with a combobox over a listbox of the app's items", () => {
    open();
    const dialog = screen.getByRole("dialog", { name: "Open chart for…" });
    const input = screen.getByRole("combobox", { name: "Open chart for…" });
    expect(dialog.contains(input)).toBe(true);
    expect(input.getAttribute("placeholder")).toBe("Type to search");
    const list = screen.getByRole("listbox", { name: "Choices" });
    expect(input.getAttribute("aria-controls")).toBe(list.id);
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "LMNALumina Corp",
      "ORBDOrbital Dynamics",
      "HLXSHelix Systems",
      "KSTRKestrel Lumber",
    ]);
    expect(options[0]!.getAttribute("aria-selected")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0]!.id);
  });

  it("filters by label and hint, labels that start with the text first; Enter chooses", () => {
    const jali = open();
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "o" } });
    // ORBD starts with "o", so it comes first; Lumina Corp has an "o" in its name.
    expect(screen.getAllByRole("option").map((o) => o.textContent?.slice(0, 4))).toEqual([
      "ORBD",
      "LMNA",
    ]);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => {
      vi.runAllTimers();
    });
    expect(charts(jali)).toEqual(["LMNA"]);
  });

  it("a click chooses; Esc closes and chooses nothing", () => {
    const jali = open();
    fireEvent.click(screen.getByRole("option", { name: /ORBD/ }));
    act(() => {
      vi.runAllTimers();
    });
    expect(charts(jali)).toEqual(["ORBD"]);
    act(() => {
      runCommand(jali, "markets.chart");
    });
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => {
      vi.runAllTimers();
    });
    expect(charts(jali)).toEqual(["ORBD"]);
  });

  it("starts on the current item and marks it", () => {
    vi.useFakeTimers();
    const jali = make();
    render(<JaliRoot jali={jali} />);
    act(() => {
      jali.dialogs.choose({
        title: "Pick",
        items: INSTRUMENTS,
        label: (i) => i.symbol,
        current: INSTRUMENTS[2],
        onChoose: () => {},
      });
    });
    const options = screen.getAllByRole("option");
    expect(options[2]!.getAttribute("aria-selected")).toBe("true");
    expect(options[2]!.getAttribute("aria-current")).toBe("true");
    expect(options[2]!.hasAttribute("data-current")).toBe(true);
    expect(options.filter((o) => o.hasAttribute("data-current"))).toHaveLength(1);
    expect(screen.getByRole("combobox").getAttribute("aria-activedescendant")).toBe(options[2]!.id);
  });

  it("says nothing matches in the workspace's words", () => {
    vi.useFakeTimers();
    const jali = make({
      messages: {
        chooser: {
          choosePlaceholder: "Rechercher",
          chooseListLabel: "Choix",
          chooseEmpty: (q) => `Rien ne correspond à « ${q} ».`,
        },
      },
    });
    render(<JaliRoot jali={jali} />);
    act(() => {
      runCommand(jali, "markets.chart");
    });
    const input = screen.getByRole("combobox");
    expect(input.getAttribute("placeholder")).toBe("Rechercher");
    expect(screen.getByRole("listbox", { name: "Choix" })).toBeTruthy();
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.getByText("Rien ne correspond à « zzz »."));
  });
});
