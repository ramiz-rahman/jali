/**
 * Tab semantics at the pane boundary (react-opus REACT-10, react-codex REACT-6): a tile's tabs control a tabpanel,
 * which the shown tab labels, and no tab controls an element that contains it; the phone's stacked view, which shows
 * two panes, says both are selected; a curated page's tabs control the view they show.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row, tabs } from "@jali/core";
import { JaliRoot, JaliView, definePage, definePane } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

afterEach(cleanup);

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  width: { min: 200 },
  Component: ({ params }) => <p>body {params.id}</p>,
});

const controlled = (tab: Element) => document.getElementById(tab.getAttribute("aria-controls")!);

describe("a tile's tabs", () => {
  it("control a tabpanel the shown tab labels, never their own ancestor", () => {
    const jali = createJali({
      panes: [note],
      layout: row(
        tabs(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" })),
        pane(note({ id: 3 }), { id: "c" }),
      ),
      features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
    });
    render(<JaliRoot jali={jali} />);
    const tabEls = [...document.querySelectorAll('.jali-tablist [role="tab"]')];
    expect(tabEls.length).toBe(2);
    for (const t of tabEls) {
      const panel = controlled(t);
      expect(panel).not.toBeNull();
      expect(panel!.contains(t)).toBe(false);
    }
    const shown = tabEls.find((t) => t.getAttribute("aria-selected") === "true")!;
    const panel = controlled(shown)!;
    expect(panel.getAttribute("role")).toBe("tabpanel");
    expect(panel.getAttribute("aria-labelledby")).toBe(shown.id);
    expect(panel.textContent).toContain("body 1");
  });
});

describe("the stacked phone view", () => {
  it("says both panes on screen are selected", () => {
    const jali = createJali({
      panes: [note],
      layout: pane(note({ id: 1 }), { id: "a" }),
      features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
      storage: memoryStorage(),
      size: { width: 378, height: 760 },
      phone: { stack: true },
      moveFocus: false,
    });
    jali.actions.openBeside("a", note({ id: 2 }));
    expect(jali.model().stacked).toBeDefined();
    const size = { clientWidth: 390, clientHeight: 772 };
    for (const [k, v] of Object.entries(size))
      Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get: () => v });
    try {
      render(<JaliRoot jali={jali} />);
    } finally {
      for (const k of Object.keys(size))
        delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
    }
    const list = document.querySelector(".jali-switch-list");
    expect(list!.getAttribute("aria-multiselectable")).toBe("true");
    const inView = [...document.querySelectorAll(".jali-switch-item[data-in-view]")];
    expect(inView.length).toBe(2);
    for (const t of inView) expect(t.getAttribute("aria-selected")).toBe("true");
  });
});

describe("a curated page's tabs", () => {
  it("control the view they show", () => {
    const Icon = () => null;
    const page = definePage({
      id: "visit",
      name: "Visit",
      itemNoun: "visit",
      home: "summary",
      roles: [{ id: "summary", label: "Summary", priority: "primary", icon: Icon }],
      firstItem: 1,
      bind: (item: number) => ({ summary: note({ id: item }) }),
      build: (item: number) => pane(note({ id: item }), { id: "summary", role: "summary" }),
      Header: ({ item }) => <h1>Visit {item}</h1>,
    });
    const jali = createJali({
      panes: [note],
      page,
      features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
    });
    jali.page!.open();
    render(
      <JaliRoot jali={jali}>
        <JaliView />
      </JaliRoot>,
    );
    const tab = document.querySelector('.jali-page-tabs [role="tab"]')!;
    expect(controlled(tab)?.getAttribute("data-pane")).toBe("summary");
  });
});
