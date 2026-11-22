import { own } from "@jali/core/adapter";
import type { PaneNode } from "@jali/core";
import { paneDomId } from "@jali/core/adapter";
import { Activity } from "../pane/Activity";
import { KindIcon } from "../pane/icons";
import { UnsavedMark, useUnsavedOf } from "../pane/Unsaved";
import { useActions, useModelValue, usePaneAttributesOf, useStore, useUi } from "../state/react";
import { ICON } from "../icons/sized";

/**
 * Scrolls the switcher's own list so the selected entry is in it, and nothing else: `scrollIntoView` would also scroll
 * the page to this instance, pulling the reader away from wherever they are (a docs page with several instances).
 */
export function revealInList(el: HTMLElement | null) {
  const list = el?.parentElement;
  if (!el || !list) return;
  // By the boxes on screen, so it reads the same right to left, where scrollLeft counts down from 0.
  const r = el.getBoundingClientRect();
  const l = list.getBoundingClientRect();
  if (r.left < l.left) list.scrollLeft -= l.left - r.left;
  else if (r.right > l.right) list.scrollLeft += r.right - l.right;
}

/** One pane in Single view's switcher. */
export function SwitcherItem({
  node,
  selected,
  inView,
}: {
  node: PaneNode;
  selected: boolean;
  inView?: boolean;
}) {
  const activity = useUi((s) => own(s.activity, node.id));
  const dirty = useUnsavedOf(node.id);
  const title = useModelValue((m) => m.title(node.id));
  const marks = usePaneAttributesOf(node.id);
  const tucked = useModelValue((m) => !!m.tuckOf(node.id));
  const actions = useActions();
  const store = useStore();
  return (
    <button
      type="button"
      {...marks}
      role="tab"
      className={`jali-switch-item${selected ? " is-active" : ""}${tucked ? " is-tucked" : ""}`}
      // In stacked view both panes on screen are selected (the list says it is multi-selectable).
      aria-selected={selected || !!inView}
      aria-controls={paneDomId(store.dom.id, node.id)}
      tabIndex={selected ? 0 : -1}
      data-tucked={tucked || undefined}
      data-in-view={inView || undefined}
      data-unsaved={dirty || undefined}
      aria-description={dirty ? store.messages.pane.unsaved : undefined}
      onClick={() => actions.focusPane(node.id)}
      ref={selected ? revealInList : undefined}
      // An arrow key's focus too: it moves with preventScroll, so it comes into the list here.
      onFocus={(e) => revealInList(e.currentTarget)}
    >
      <KindIcon kind={node.ref.kind} {...ICON.tab} />
      <span className="jali-switch-title">{title}</span>
      {dirty ? <UnsavedMark /> : null}
      <Activity activity={activity} />
    </button>
  );
}
