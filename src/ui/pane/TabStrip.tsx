import { Plus, Undo2, X } from "lucide-react";
import type { NodeId, PaneNode } from "../../layout-core/types";
import { shortcutLabel } from "../commands/registry";
import { paneDomId, paneTitleId } from "../dom/ids";
import { getProfile, roleOf, titleOf } from "../profile";
import { useStore, useUi } from "../state/react";
import { startPaneDrag } from "../workspace/dnd";
import type { Frame } from "../workspace/frames";
import { Activity } from "./Activity";
import { KindIcon } from "./icons";

/** Keep the active tab visible by scrolling only the tab strip (scrollIntoView would also move the workspace). */
function revealTab(el: HTMLDivElement | null) {
  const strip = el?.parentElement;
  if (!el || !strip) return;
  if (el.offsetLeft < strip.scrollLeft) strip.scrollLeft = el.offsetLeft;
  else if (el.offsetLeft + el.offsetWidth > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = el.offsetLeft + el.offsetWidth - strip.clientWidth;
}

function TabActivity({ id }: { id: NodeId }) {
  return <Activity a={useUi((s) => s.activity[id])} />;
}

/** A group's tabs. `owner` is the frame showing the group: the active tab's title labels its region. */
export function TabStrip({ group, owner }: { group: NonNullable<Frame["group"]>; owner: NodeId }) {
  const store = useStore();
  const { actions } = store;
  // A curated page: no "+" (its views come from the page's tabs).
  const review = useUi((s) => !!s.review);
  // A curated page's views live in the page tabs: here only the shown one and panes opened from links, never a repeat.
  const tabs = review ? group.tabs.filter(({ node: t }) => !t.role || t.id === group.active) : group.tabs;
  return (
    <div className="tabbar">
      <div className="tabs" role="tablist" aria-label={`Tabs: ${tabs.length}`}>
        {tabs.map(({ node: t, tucked }) => {
          const active = t.id === group.active;
          const title = titleOf(t);
          return (
            <div
              key={t.id}
              ref={active ? revealTab : undefined}
              className={`tab${active ? " is-active" : ""}${tucked ? " is-tucked" : ""}`}
              data-tab={t.id}
              data-tucked={tucked || undefined}
              aria-description={tucked ? "Tucked here. Put back to restore its place." : undefined}
              role="tab"
              aria-selected={active}
              aria-controls={paneDomId(t.id)}
              tabIndex={active ? 0 : -1}
              data-drag-ok
              onPointerDown={(e) => {
                e.stopPropagation();
                startPaneDrag(store, e, t.id);
              }}
              onClick={() => actions.setActiveTab(group.id, t.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  actions.setActiveTab(group.id, t.id);
                }
              }}
            >
              <TabIcon node={t} />
              <span className="tab-title" id={active ? paneTitleId(owner) : undefined}>{title}</span>
              <TabActivity id={t.id} />
              {tucked ? (
                <button className="tab-putback" aria-label={`Put back ${title}`} title={`Put back · ${shortcutLabel("pane.putBack")}`} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); actions.putBack(t.id); }}>
                  <Undo2 size={14} strokeWidth={1.75} aria-hidden />
                </button>
              ) : null}
              <button className="tab-close" aria-label={`Close ${title}`} onClick={(e) => { e.stopPropagation(); actions.close(t.id); }}>
                <X size={14} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
      {review ? null : <button
        className="tab-add"
        aria-label="New tab in this stack"
        title="New tab"
        onClick={(e) => {
          e.stopPropagation();
          actions.newTab(group.active);
        }}
      >
        <Plus size={14} strokeWidth={1.5} aria-hidden />
      </button>}
    </div>
  );
}

/** A role tab shows its role's icon; anything else its kind's. */
function TabIcon({ node }: { node: PaneNode }) {
  const role = useUi((s) => !!s.review) && node.role ? roleOf(getProfile()!, node.role) : undefined;
  return role ? <role.icon size={14} strokeWidth={1.5} aria-hidden /> : <KindIcon kind={node.ref.kind} size={14} />;
}
