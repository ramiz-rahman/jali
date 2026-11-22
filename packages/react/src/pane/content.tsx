/**
 * Each pane's content renders once, in one place, for as long as the pane is in the layout: into an element of its
 * own (`.jali-pane-content-inner`) that its frame holds. A frame that changes parent (a pane entering or leaving a row
 * that scrolls sideways, the layout flipping between tiled panes and one pane at a time) remounts, but the content doesn't: the
 * new frame takes the same element, so the component keeps its state, its subscriptions and its DOM.
 *
 * An instance that hydrates a server's HTML renders its content inside its frames, as the server did (a portal can't
 * be server rendered): there a frame that changes parent still remounts its content.
 */
import { createContext, memo, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import type { Frame, JaliStore } from "@jali/core/adapter";
import { PaneBody, paneHost, type PaneHost } from "./PaneBody";
import { createHeaderSlot, type HeaderSlot } from "./header";
import { usePoppedOut } from "./popped";
import { useStore } from "../state/react";

/** A pane's lasting parts: the element its content renders into, its header slot and what its content can ask. */
export interface ContentHost {
  el: HTMLDivElement;
  header: HeaderSlot;
  host: PaneHost;
}

/** The instance's content hosts, by pane id; null where content renders inside its frame (hydration, a server). */
export const ContentHosts = /* @__PURE__ */ createContext<((id: string) => ContentHost) | null>(
  null,
);

/** Each instance's content hosts, by pane id: they go with the instance. */
const hostsOf = new WeakMap<JaliStore, Map<string, ContentHost>>();

/** The hosts of one instance, made as panes first render and dropped with the pane (`keep`). Another instance (the
 *  root given a new `jali`) gets hosts of its own, even for the same pane ids: an old host's listeners and what its
 *  content can ask act for the old instance, and a new element remounts the content, so its state starts over. */
export function useContentHosts(store: JaliStore, on: boolean) {
  // The instance's own, not the component's: nothing changes while rendering, and a memo React might drop would
  // remount every pane's content.
  let all = hostsOf.get(store);
  if (!all) hostsOf.set(store, (all = new Map()));
  // The old instance's elements leave the frames the new ones went into.
  const was = useRef(all);
  useEffect(() => {
    if (was.current === all) return;
    for (const h of was.current.values()) h.el.remove();
    was.current = all;
  }, [all]);
  const get = useMemo(
    () => (id: string) => {
      let h = all.get(id);
      if (!h) {
        const el = document.createElement("div");
        el.className = "jali-pane-content-inner";
        // Pop out moves this element into its window (features/pop-out.tsx), and finds it by this mark.
        el.setAttribute("data-jali-host", "");
        // The frame's own handlers don't hear what happens in content rendered elsewhere: a press or focus in it
        // focuses the pane, as a press anywhere in the frame does.
        el.addEventListener("pointerdown", () => store.actions.focusPane(id), true);
        el.addEventListener(
          "focusin",
          () => store.get().view.focused !== id && store.actions.focusPane(id),
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

/** A pane's content, rendered into its host (which Pop out moves into its window). */
export const PaneContent = /* @__PURE__ */ memo(function PaneContent({
  frame,
  at,
}: {
  frame: Frame;
  at: ContentHost;
}) {
  const store = useStore();
  const { node, hidden, covered, focused } = frame;
  // Popped out, the element itself is in the floating window: the same portal, so nothing remounts.
  const { out } = usePoppedOut(store, node.id);
  return createPortal(
    <PaneBody
      node={node}
      host={at.host}
      header={at.header}
      paused={!out && (hidden || covered || !!frame.outOfView)}
      focused={focused}
    />,
    at.el,
  );
});
