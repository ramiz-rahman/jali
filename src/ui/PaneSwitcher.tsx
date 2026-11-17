import type { PaneNode } from "../layout-core/types";
import { KindIcon, ActivityDot } from "./PaneFrame";
import { paneTitle } from "./pane-kinds";
import { tuckedFrom, actions, useUi } from "./store";
import { paneDomId } from "./ids";

function Item({ node, selected }: { node: PaneNode; selected: boolean }) {
  const activity = useUi((s) => s.activity[node.id]);
  const title = paneTitle(node.ref);
  return (
    <button
      role="tab"
      className={`switch-item${selected ? " is-active" : ""}${tuckedFrom(node.id) ? " is-tucked" : ""}`}
      aria-selected={selected}
      aria-controls={paneDomId(node.id)}
      tabIndex={selected ? 0 : -1}
      onClick={() => actions.focus(node.id)}
      ref={selected ? (el) => el?.scrollIntoView?.({ inline: "nearest", block: "nearest" }) : undefined}
    >
      <KindIcon kind={node.ref.kind} size={14} />
      <span className="switch-title">{title}</span>
      <ActivityDot a={activity} />
    </button>
  );
}

/** Single view's pane switcher: every pane and tab, the current one selected. */
export function PaneSwitcher({ panes, current }: { panes: PaneNode[]; current: string | undefined }) {
  return (
    <nav className="switcher" aria-label="Panes">
      <div className="switch-list" role="tablist" aria-label={`Panes: ${panes.length}`}
        onKeyDown={(e) => {
          const i = panes.findIndex((p) => p.id === current);
          const n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? panes.length - 1 : -1;
          if (n < 0 || !panes.length) return;
          e.preventDefault();
          const t = panes[(n + panes.length) % panes.length]!;
          actions.focus(t.id);
        }}>
        {panes.map((p) => <Item key={p.id} node={p} selected={p.id === current} />)}
      </div>
    </nav>
  );
}
