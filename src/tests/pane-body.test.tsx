/** The pane host clears a pane's unsaved work when its content unmounts, so a kind need not (finding 17). */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { useEffect } from "react";
import { createPaneKinds, createUiStore, memoryStorage, type Layout } from "@jali/core";
import { definePaneKind, type PaneComponentProps } from "@jali/react";
import { StoreProvider } from "../../packages/react/src/state/react";
import { PaneBody, paneHost } from "../../packages/react/src/pane/PaneBody";

function Draft({ setUnsaved }: PaneComponentProps) {
  useEffect(() => { setUnsaved("a draft"); }, [setUnsaved]);
  return <p>draft</p>;
}
const draft = definePaneKind({ kind: "draft", title: () => "Draft", minWidth: 200, minHeight: 100, Component: Draft });
const one = (): Layout => ({ version: 1, root: { id: "a", type: "pane", size: { weight: 1 }, ref: { kind: "draft", params: {} } } });

describe("PaneBody", () => {
  it("clears the pane's unsaved work when the content unmounts", () => {
    const store = createUiStore({ kinds: createPaneKinds([draft]), initial: { layout: one(), area: { width: 800, height: 600 } }, storage: memoryStorage(), focusPane: null });
    const node = store.model().pane("a")!;
    const host = paneHost(store.actions, "a");
    const { unmount } = render(<StoreProvider store={store}><PaneBody node={node} host={host} paused={false} focused={false} /></StoreProvider>);
    expect(store.get().unsaved).toEqual({ a: "a draft" });
    unmount();
    expect(store.get().unsaved).toEqual({});
  });
});
