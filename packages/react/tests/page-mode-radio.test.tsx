/**
 * The page bar's Single / Split view switch is an APG radio group (react-opus REACT-9, react-codex REACT-6): one tab
 * stop, the checked mode, and the arrow keys move to the other mode and check it.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane } from "@jali/core";
import { JaliRoot, PageBar, JaliView, definePage, definePane } from "@jali/react";

afterEach(cleanup);

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
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

describe("the view mode switch", () => {
  it("has one tab stop, and arrows move and check", () => {
    const jali = createJali({
      panes: [note],
      page,
      url: { location: memoryLocation() },
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
    });
    jali.actions.openPage();
    const { getAllByRole } = render(
      <JaliRoot jali={jali}>
        <JaliView />
      </JaliRoot>,
    );
    const [single, split] = getAllByRole("radio");
    expect([single!.tabIndex, split!.tabIndex]).toEqual([0, -1]);
    single!.focus();
    act(() => void fireEvent.keyDown(single!, { key: "ArrowRight" }));
    const can = jali.get().page!.canInvestigate;
    if (can) {
      expect(jali.get().page!.mode).toBe("split");
      expect(document.activeElement).toBe(split);
      expect([single!.tabIndex, split!.tabIndex]).toEqual([-1, 0]);
      act(() => void fireEvent.keyDown(split!, { key: "ArrowUp" }));
      expect(jali.get().page!.mode).toBe("single");
    } else {
      expect(document.activeElement).toBe(split);
      expect(split!.getAttribute("aria-disabled")).toBe("true");
      expect(jali.get().page!.mode).toBe("single");
    }
  });
});
