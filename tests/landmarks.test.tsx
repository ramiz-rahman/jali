/**
 * Jali's landmarks: a curated page's view tabs are in a named landmark (Loan review FINDINGS.md #2), so a
 * screen-reader user who moves by landmarks reaches them.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane } from "@jali/core";
import { JaliRoot, JaliView, definePage, definePane } from "@jali/react";

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
      url: { location: memoryLocation() },
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
    });
    jali.actions.openPage();
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
