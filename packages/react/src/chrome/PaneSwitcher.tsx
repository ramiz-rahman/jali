import { own } from "@jali/core/adapter";
import type { PaneNode } from "@jali/core";
import { paneDomId, titleOf } from "@jali/core/adapter";
import { useRef } from "react";
import { useRovingKeys } from "../a11y/roving";
import { Activity } from "../pane/Activity";
import { KindIcon } from "../pane/icons";
import { UnsavedMark, useUnsavedOf } from "../pane/Unsaved";
import {
  useActions,
  useMessages,
  useModelValue,
  usePaneAttributesOf,
  useStore,
  useUi,
} from "../state/react";
import { ICON } from "../icons/sized";

/**
 * Scrolls the switcher's own list so the selected entry is in it, and nothing else: `scrollIntoView` would also scroll
 * the page to this workspace, pulling the reader away from wherever they are (a docs page with several workspaces).
 */
function revealInList(el: HTMLElement | null) {
  const list = el?.parentElement;
  if (!el || !list) return;
  // By the boxes on screen, so it reads the same right to left, where scrollLeft counts down from 0.
  const r = el.getBoundingClientRect();
  const l = list.getBoundingClientRect();
  if (r.left < l.left) list.scrollLeft -= l.left - r.left;
  else if (r.right > l.right) list.scrollLeft += r.right - l.right;
}

function Item({ node, selected, inView }: { node: PaneNode; selected: boolean; inView?: boolean }) {
  const activity = useUi((s) => own(s.activity, node.id));
  const dirty = useUnsavedOf(node.id);
  const titles = useUi((s) => s.titles);
  const marks = usePaneAttributesOf(node.id);
  const tucked = useModelValue((m) => !!m.tuckOf(node.id));
  const actions = useActions();
  const store = useStore();
  return (
    <button
      {...marks}
      role="tab"
      className={`jali-switch-item${selected ? " is-active" : ""}${tucked ? " is-tucked" : ""}`}
      aria-selected={selected}
      aria-controls={paneDomId(store.dom.id, node.id)}
      tabIndex={selected ? 0 : -1}
      data-tucked={tucked || undefined}
      data-in-view={inView || undefined}
      data-unsaved={dirty || undefined}
      aria-description={dirty ? store.messages.pane.unsaved : undefined}
      onClick={() => actions.focus(node.id)}
      ref={selected ? revealInList : undefined}
    >
      <KindIcon kind={node.ref.kind} {...ICON.tab} />
      <span className="jali-switch-title">{titleOf(store.env, node, titles)}</span>
      {dirty ? <UnsavedMark /> : null}
      <Activity a={activity} />
    </button>
  );
}

/** Single view's pane switcher: every pane and tab, the current one selected. */
export function PaneSwitcher({
  panes,
  current,
  inView,
}: {
  panes: PaneNode[];
  current: string | undefined;
  /** Stacked view: both panes on screen, the current one among them. */
  inView?: string[];
}) {
  const t = useMessages().workspace;
  const list = useRef<HTMLDivElement>(null);
  // ← → Home End move focus along the panes, wrapping both ways; Enter, Space or a click switches (manual activation:
  // switching moves focus into the pane, which would end the walk after one step).
  const keys = useRovingKeys(() => [
    ...(list.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []),
  ]);
  return (
    <nav className="jali-switcher" aria-label={t.switcher}>
      <div
        className="jali-switch-list"
        role="tablist"
        aria-label={t.switcherList(panes.length)}
        ref={list}
        onKeyDown={keys}
      >
        {panes.map((p) => (
          <Item key={p.id} node={p} selected={p.id === current} inView={inView?.includes(p.id)} />
        ))}
      </div>
    </nav>
  );
}
