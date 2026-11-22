/**
 * Each pane's content renders once, in one place, for as long as the pane is in the layout: into an element of its
 * own (`.jali-pane-content-inner`) that its frame holds. A frame that changes parent (a pane entering or leaving a row
 * that scrolls sideways, the workspace flipping between tiled and single view) remounts, but the content doesn't: the
 * new frame takes the same element, so the component keeps its state, its subscriptions and its DOM.
 *
 * A workspace that hydrates a server's HTML renders its content inside its frames, as the server did (a portal can't
 * be server rendered): there a frame that changes parent still remounts its content.
 */
import { createContext, memo, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import type { Frame, JaliStore } from "@jali/core/adapter";
import { PaneBody, paneHost, type PaneHost } from "./PaneBody";
import { createHeaderSlot, type HeaderSlot } from "./header";
import { usePopOutTarget } from "./PopOut";
import { useStore } from "../state/react";

/** A pane's lasting parts: the element its content renders into, its header slot and what its content can ask. */
export interface ContentHost {
  el: HTMLDivElement;
  header: HeaderSlot;
  host: PaneHost;
}

/** The workspace's content hosts, by pane id; null where content renders inside its frame (hydration, a server). */
export const ContentHosts = /* @__PURE__ */ createContext<((id: string) => ContentHost) | null>(
  null,
);

/** The hosts of one workspace, made as panes first render and dropped with the pane (`keep`). */
export function useContentHosts(store: JaliStore, on: boolean) {
  const all = useRef(new Map<string, ContentHost>()).current;
  const get = useMemo(
    () => (id: string) => {
      let h = all.get(id);
      if (!h) {
        const el = document.createElement("div");
        el.className = "jali-pane-content-inner";
        // The frame's own handlers don't hear what happens in content rendered elsewhere: a press or focus in it
        // focuses the pane, as a press anywhere in the frame does.
        el.addEventListener("pointerdown", () => store.actions.focus(id), true);
        el.addEventListener(
          "focusin",
          () => store.get().view.focused !== id && store.actions.focus(id),
          true,
        );
        all.set(id, (h = { el, header: createHeaderSlot(), host: paneHost(store, id) }));
      }
      return h;
    },
    [store, all],
  );
  /** Drops the hosts of panes that left. */
  const keep = (ids: Set<string>) => {
    for (const id of all.keys()) if (!ids.has(id)) all.delete(id);
  };
  return { get: on ? get : null, keep };
}

/** A pane's content, rendered into its host (or the floating window, popped out). */
export const PaneContent = /* @__PURE__ */ memo(function PaneContent({
  frame,
  at,
}: {
  frame: Frame;
  at: ContentHost;
}) {
  const store = useStore();
  const { node, hidden, covered, focused } = frame;
  const popTarget = usePopOutTarget(store, node.id);
  const body = (
    <PaneBody
      node={node}
      host={at.host}
      header={at.header}
      paused={!popTarget && (hidden || covered || !!frame.outOfView)}
      focused={focused}
    />
  );
  return popTarget
    ? createPortal(<div className="jali-pane-content-inner">{body}</div>, popTarget)
    : createPortal(body, at.el);
});
