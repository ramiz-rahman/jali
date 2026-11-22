/**
 * Where a pane's content goes: the one place that knows. A frame asks for its pane's parts (`usePaneParts`) and draws
 * an outlet (`PaneOutlet`); how the content gets there is this module's.
 *
 * - **Rendered once** (the browser, after a client render): each pane's content renders into an element of its own
 *   (`.jali-pane-content-inner`), for as long as the pane is in the layout, and its frame's outlet holds that element.
 *   A frame that changes parent (a pane entering or leaving a row that scrolls sideways, the layout flipping between
 *   tiled panes and one pane at a time) remounts, but the content doesn't: the new frame takes the same element, so the
 *   component keeps its state, its subscriptions and its DOM. Pop out moves the element into its window.
 * - **In the frame** (an instance that hydrates a server's HTML, and a server): the content renders inside the outlet,
 *   as the server did (a portal can't be server rendered), so a frame that changes parent remounts it; popped out, it
 *   renders in the window instead. Which one an instance uses is fixed when it mounts: switching after hydration would
 *   itself remount every pane's content.
 */
import { createContext, memo, useContext, useMemo, type HTMLAttributes } from "react";
import { createPortal } from "react-dom";
import type { NodeId } from "@jali/core";
import type { Frame, JaliStore } from "@jali/core/adapter";
import { PaneBody, paneHost, type PaneHost } from "./PaneBody";
import { createHeaderSlot, type HeaderSlot } from "./header-slot";
import { popOutOf, usePoppedOut } from "./popped";
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

/** The hosts of one instance, made as panes first render and dropped with the pane (`keep`). Kept by the instance, not
 *  the component, so the panes moving between the free layout and a curated page keep their content. Another instance
 *  (the root given a new `jali`) has hosts of its own, even for the same pane ids, and mounts its panes afresh
 *  (InstanceScope). */
export function useContentHosts(store: JaliStore, on: boolean) {
  // The instance's own, not the component's: nothing changes while rendering, and a memo React might drop would
  // remount every pane's content.
  let all = hostsOf.get(store);
  if (!all) hostsOf.set(store, (all = new Map()));
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

/** A pane's parts as its frame uses them: what its content can ask, its header slot, and its lasting host when the
 *  instance renders content once. */
export interface PaneParts {
  host: PaneHost;
  header: HeaderSlot;
  /** The pane's lasting host; undefined where content renders in its frame. */
  at: ContentHost | undefined;
}

/** Pane `id`'s parts: its lasting host's, or (content in the frame) the frame's own. */
export function usePaneParts(id: NodeId): PaneParts {
  const store = useStore();
  const at = useContext(ContentHosts)?.(id);
  const ownHost = useMemo(() => paneHost(store, id), [store, id]);
  const ownHeader = useMemo(createHeaderSlot, []);
  return { host: at?.host ?? ownHost, header: at?.header ?? ownHeader, at };
}

/**
 * The frame's content area (`.jali-pane-content`): the pane's lasting element moved in, or its content rendered here
 * (in the frame), or, while it is popped out, a note that says so with Bring back. `panel` is the area's own
 * attributes (its id, and its tab panel role).
 */
export function PaneOutlet({
  frame,
  parts,
  panel,
}: {
  frame: Frame;
  parts: PaneParts;
  panel: HTMLAttributes<HTMLDivElement>;
}) {
  const store = useStore();
  const { node, hidden, covered, focused } = frame;
  const { at, host, header } = parts;
  const { out, target } = usePoppedOut(store, node.id);
  const body = (paused: boolean) => (
    <div className="jali-pane-content-inner">
      <PaneBody node={node} host={host} header={header} paused={paused} focused={focused} />
    </div>
  );
  return (
    <div
      {...panel}
      className="jali-pane-content"
      // Rendered once: the lasting element moves in here. Not while popped out: the window holds it then, and gives
      // it back when it closes.
      ref={at && !out ? (el) => void (el && el.lastChild !== at.el && el.append(at.el)) : undefined}
    >
      {out ? (
        <div className="jali-popped-out" role="status">
          <span>{store.messages.pane.poppedOut}</span>
          <button
            type="button"
            className="jali-text-btn"
            onClick={() => popOutOf(store)?.close(store)}
          >
            {store.messages.pane.bringBack}
          </button>
        </div>
      ) : null}
      {at
        ? null
        : target
          ? createPortal(body(false), target)
          : body(hidden || covered || !!frame.outOfView)}
    </div>
  );
}
