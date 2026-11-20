/**
 * The pane hooks hold one report per call, not one slot per pane (QUALITY-REVIEW P11): several components in a pane
 * may call useCommands, useUnsaved, useActivity, useTitle and usePaneAttributes, and the workspace merges them. One
 * unmounting takes only its own report away.
 */
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { useState, type ReactNode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { createJali, memoryStorage, pane, row, type PaneActivity } from "@jali/core";
import { mergeReports, storeOf } from "@jali/core/adapter";
import {
  JaliRoot,
  JaliView,
  definePane,
  useActivity,
  useCommands,
  usePaneAttributes,
  useTitle,
  useUnsaved,
} from "@jali/react";

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
        if (!this.classList.contains("jali-workspace")) return 0;
        return prop === "clientWidth" ? 1200 : 600;
      },
    });
});
afterEach(cleanup);

function Child({ activity }: { activity: PaneActivity }) {
  useUnsaved("a draft reply");
  useCommands([{ id: "send", title: "Send reply", run: () => {} }]);
  useActivity(activity);
  useTitle("Reply to Acme");
  usePaneAttributes({ "data-part": "reply" });
  return <p>reply</p>;
}

let showChild: (on: boolean) => void = () => {};
let childActivity: (a: PaneActivity) => void = () => {};

function Parent({ children }: { children?: ReactNode }) {
  const [on, setOn] = useState(true);
  const [activity, setActivity] = useState<PaneActivity>("live");
  showChild = setOn;
  childActivity = setActivity;
  useUnsaved("an unsaved note");
  useCommands([{ id: "save", title: "Save note", run: () => {} }]);
  useActivity("loading");
  useTitle("Acme Ltd");
  usePaneAttributes({ "data-connection": "production" });
  return (
    <div>
      {on ? <Child activity={activity} /> : null}
      {children}
    </div>
  );
}

const note = definePane("note", { params: {}, title: () => "Note", Component: () => <Parent /> });

function mount() {
  const jali = createJali({
    panes: [note],
    layout: row(pane(note({}), { id: "n" })),
    storage: memoryStorage(),
    size: { width: 1200, height: 600 },
    moveFocus: false,
  });
  render(
    <JaliRoot jali={jali}>
      <JaliView />
    </JaliRoot>,
  );
  return storeOf(jali);
}

describe("pane hooks with several callers", () => {
  it("merges every caller: commands in order, all unsaved texts, the most pressing activity, the innermost title", () => {
    const store = mount();
    const s = store.get();
    expect(s.paneCommands.n?.map((c) => c.id)).toEqual(["save", "send"]);
    expect(s.unsaved.n).toBe("an unsaved note, a draft reply");
    expect(s.activity.n).toBe("loading");
    expect(s.titles.n).toBe("Reply to Acme");
    expect(s.paneAttributes.n).toEqual({ "data-part": "reply" });
    act(() => childActivity("error"));
    expect(store.get().activity.n).toBe("error");
  });

  it("a child unmounting takes only its own reports away", () => {
    const store = mount();
    act(() => showChild(false));
    const s = store.get();
    expect(s.paneCommands.n?.map((c) => c.id)).toEqual(["save"]);
    expect(s.unsaved.n).toBe("an unsaved note");
    expect(s.activity.n).toBe("loading");
    expect(s.titles.n).toBe("Acme Ltd");
    expect(s.paneAttributes.n).toEqual({ "data-connection": "production" });
  });

  it("a child mounted later goes after the parent, and its title wins", () => {
    const store = mount();
    act(() => showChild(false));
    act(() => showChild(true));
    expect(store.get().paneCommands.n?.map((c) => c.id)).toEqual(["save", "send"]);
    expect(store.get().titles.n).toBe("Reply to Acme");
  });

  it("merges by order, keeps the first of a repeated command id and drops nothing pressing", () => {
    const run = () => {};
    const merged = mergeReports([
      { seq: 2, commands: [{ id: "a", title: "Second", run }], activity: "live", title: "Inner" },
      {
        seq: 1,
        commands: [{ id: "a", title: "First", run }],
        activity: "needs-you",
        title: "Outer",
      },
    ]);
    expect(merged.commands?.map((c) => c.title)).toEqual(["First"]);
    expect(merged.activity).toBe("needs-you");
    expect(merged.title).toBe("Inner");
    expect(mergeReports([]).unsaved).toBeNull();
  });
});
