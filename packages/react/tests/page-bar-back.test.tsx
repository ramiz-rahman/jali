/**
 * The page bar's "Back to …" is the step's own answer (step 4 review, Codex #6): with an opened pane the app keeps
 * (`allow: { close: false }`), Back is refused, so the bar greys it out, saying why, as ⌘K does; a click changes
 * nothing.
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane } from "@jali/core";
import { JaliRoot, PageBar, JaliView, definePage, definePane } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

afterEach(cleanup);

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: () => null,
});
const kept = definePane("kept", {
  title: () => "Kept",
  allow: { close: false },
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
  bind: (item: number) => ({ summary: note({ id: item }) }),
  build: (item: number) => pane(note({ id: item }), { id: "summary", role: "summary" }),
  Header: () => <PageBar />,
});

const make = () => {
  const jali = createJali({
    panes: [note, kept],
    page,
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });
  jali.page!.open();
  jali.page!.setMode("split");
  return jali;
};
const back = (c: HTMLElement) => c.querySelector<HTMLButtonElement>(".jali-inv-back")!;

describe("the page bar's Back", () => {
  it("is greyed out, saying why, where the app keeps an opened pane, and a click closes nothing", () => {
    const jali = make();
    jali.actions.addTab("summary", kept());
    const { container } = render(
      <JaliRoot jali={jali}>
        <JaliView />
      </JaliRoot>,
    );
    expect(back(container).getAttribute("aria-disabled")).toBe("true");
    expect(back(container).title).toBe("Kept can't be closed here");
    fireEvent.click(back(container));
    expect(jali.model().panes).toHaveLength(2);
  });

  it("works where every opened pane may close", () => {
    const jali = make();
    jali.actions.addTab("summary", note({ id: 9 }));
    const { container } = render(
      <JaliRoot jali={jali}>
        <JaliView />
      </JaliRoot>,
    );
    expect(back(container).getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(back(container));
    expect(jali.model().panes).toHaveLength(1);
  });
});
