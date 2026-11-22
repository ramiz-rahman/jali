/**
 * Jali's landmarks: a curated page's view tabs are in a named landmark (Loan review FINDINGS.md #2), so a
 * screen-reader user who moves by landmarks reaches them; and a workspace the host names (`createJali({ label })`)
 * names its landmarks with it, so two workspaces on one page never repeat one.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row, type JaliOptions } from "@jali/core";
import { JaliRoot, JaliView, Shelf, definePage, definePane } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

afterEach(cleanup);

const visit = definePane("visit", {
  params: { id: Number },
  title: ({ id }) => `Visit ${id}`,
  Component: () => null,
});
const Icon = () => null;
const page = definePage({
  id: "visit",
  name: "Visit",
  itemNoun: "visit",
  home: "summary",
  roles: [{ id: "summary", label: "Summary", priority: "primary", icon: Icon }],
  firstItem: 1,
  bind: (item: number) => ({ summary: visit({ id: item }) }),
  build: (item: number) => pane(visit({ id: item }), { id: "summary", role: "summary" }),
  Header: ({ item }) => <h1>Visit {item}</h1>,
});

describe("a curated page's landmarks", () => {
  it("puts the view tabs in a navigation landmark named for the page", () => {
    const jali = createJali({
      panes: [visit],
      page,
      features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
    });
    jali.page!.open();
    const { getByRole } = render(
      <JaliRoot jali={jali}>
        <JaliView />
      </JaliRoot>,
    );
    const nav = getByRole("navigation", { name: "Visit views" });
    expect(nav.querySelector("[role=tablist]")).not.toBeNull();
    expect(nav.closest(".jali-page")).not.toBeNull();
  });
});

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  width: { min: 200 },
  Component: () => null,
});
const workspace = (options: Partial<JaliOptions>) =>
  createJali({
    panes: [note],
    layout: row(note({ id: 1 }), note({ id: 2 }), note({ id: 3 })),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1200, height: 600 },
    moveFocus: false,
    keyboard: { scope: "local" },
    ...options,
  });

/** Every landmark's role and name under `root`, as axe's landmark-unique rule reads them. */
const landmarks = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>("section, nav, aside, main, [role=region]")].map(
    (el) =>
      `${el.getAttribute("role") ?? el.tagName.toLowerCase()} ${el.getAttribute("aria-label") ?? `#${el.getAttribute("aria-labelledby")}`}`,
  );

describe("a workspace the host names", () => {
  it("names its landmark, and each of Jali's landmarks in it, with its name", () => {
    const jali = workspace({ id: "sales", label: "Sales" });
    jali.actions.tuck(jali.model().panes[2]!.id);
    const { getByRole } = render(
      <JaliRoot jali={jali}>
        <JaliView />
        <Shelf />
      </JaliRoot>,
    );
    expect(getByRole("region", { name: "Sales" }).classList.contains("jali-workspace")).toBe(true);
    expect(getByRole("region", { name: "Note 2, Sales" })).toBeTruthy();
    expect(getByRole("region", { name: "Shelf, Sales" })).toBeTruthy();
  });

  it("lets two workspaces on one page share no landmark name", () => {
    const a = workspace({ id: "a", label: "Sales" });
    const b = workspace({ id: "b", label: "Support" });
    const { container } = render(
      <>
        <JaliRoot jali={a}>
          <JaliView />
        </JaliRoot>
        <JaliRoot jali={b}>
          <JaliView />
        </JaliRoot>
      </>,
    );
    const names = landmarks(container);
    expect(names.length).toBeGreaterThan(2);
    expect(new Set(names).size).toBe(names.length);
  });

  it("leaves Jali's names as they are without one", () => {
    const { getByRole } = render(
      <JaliRoot jali={workspace({})}>
        <JaliView />
      </JaliRoot>,
    );
    expect(getByRole("region", { name: "Panes" })).toBeTruthy();
    const pane1 = getByRole("region", { name: "Note 1" });
    expect(pane1.hasAttribute("aria-labelledby")).toBe(true);
  });
});
