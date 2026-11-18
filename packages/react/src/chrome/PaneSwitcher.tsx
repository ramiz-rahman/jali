import type { PaneNode } from "@jali/core";
import { paneDomId } from "@jali/core";
import { Activity } from "../pane/Activity";
import { KindIcon } from "../pane/icons";
import { titleOf } from "@jali/core";
import { useActions, useModel, useStore, useUi } from "../state/react";

function Item({ node, selected }: { node: PaneNode; selected: boolean }) {
  const activity = useUi((s) => s.activity[node.id]);
  const tucked = !!useModel().tuckOf(node.id);
  const actions = useActions();
  const store = useStore();
  return (
    <button
      role="tab"
      className={`jali-switch-item${selected ? " is-active" : ""}${tucked ? " is-tucked" : ""}`}
      aria-selected={selected}
      aria-controls={paneDomId(store.dom.id, node.id)}
      tabIndex={selected ? 0 : -1}
      onClick={() => actions.focus(node.id)}
      ref={selected ? (el) => el?.scrollIntoView?.({ inline: "nearest", block: "nearest" }) : undefined}
    >
      <KindIcon kind={node.ref.kind} size={14} />
      <span className="jali-switch-title">{titleOf(store.env, node)}</span>
      <Activity a={activity} />
    </button>
  );
}

/** Single view's pane switcher: every pane and tab, the current one selected. */
export function PaneSwitcher({ panes, current }: { panes: PaneNode[]; current: string | undefined }) {
  const actions = useActions();
  const store = useStore();
  return (
    <nav className="jali-switcher" aria-label="Panes">
      <div className="jali-switch-list" role="tablist" aria-label={`Panes: ${panes.length}`}
        onKeyDown={(e) => {
          const i = panes.findIndex((p) => p.id === current);
          const n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? panes.length - 1 : -1;
          if (n < 0 || !panes.length) return;
          e.preventDefault();
          actions.focus(panes[(n + panes.length) % panes.length]!.id);
        }}>
        {panes.map((p) => <Item key={p.id} node={p} selected={p.id === current} />)}
      </div>
    </nav>
  );
}
