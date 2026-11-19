import type { PaneNode } from "@jali/core";
import { inlineStep, paneDomId, titleOf } from "@jali/core/adapter";
import { Activity } from "../pane/Activity";
import { KindIcon } from "../pane/icons";
import { UnsavedMark, useUnsavedOf } from "../pane/Unsaved";
import {
  useActions,
  useMessages,
  useModel,
  usePaneAttributesOf,
  useStore,
  useUi,
} from "../state/react";

function Item({ node, selected }: { node: PaneNode; selected: boolean }) {
  const activity = useUi((s) => s.activity[node.id]);
  const dirty = useUnsavedOf(node.id);
  const titles = useUi((s) => s.titles);
  const marks = usePaneAttributesOf(node.id);
  const tucked = !!useModel().tuckOf(node.id);
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
      data-unsaved={dirty || undefined}
      aria-description={dirty ? store.messages.pane.unsaved : undefined}
      onClick={() => actions.focus(node.id)}
      ref={
        selected ? (el) => el?.scrollIntoView?.({ inline: "nearest", block: "nearest" }) : undefined
      }
    >
      <KindIcon kind={node.ref.kind} size={14} />
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
}: {
  panes: PaneNode[];
  current: string | undefined;
}) {
  const actions = useActions();
  const t = useMessages().workspace;
  const dir = useUi((s) => s.dir);
  return (
    <nav className="jali-switcher" aria-label={t.switcher}>
      <div
        className="jali-switch-list"
        role="tablist"
        aria-label={t.switcherList(panes.length)}
        onKeyDown={(e) => {
          const i = panes.findIndex((p) => p.id === current);
          const step = inlineStep(e.key, dir);
          const n = step
            ? i + step
            : e.key === "Home"
              ? 0
              : e.key === "End"
                ? panes.length - 1
                : -1;
          if (n < 0 || !panes.length) return;
          e.preventDefault();
          actions.focus(panes[(n + panes.length) % panes.length]!.id);
        }}
      >
        {panes.map((p) => (
          <Item key={p.id} node={p} selected={p.id === current} />
        ))}
      </div>
    </nav>
  );
}
