import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FoldHorizontal, Plus, Undo2, X } from "lucide-react";
import type { NodeId, PaneNode } from "../../layout-core/types";
import { shortcutLabel } from "../commands/registry";
import { paneDomId, paneTitleId } from "../dom/ids";
import { roleOf, titleOf } from "../profile";
import { useEnv, useStore, useUi } from "../state/react";
import { startPaneDrag } from "../workspace/dnd";
import type { Frame, Tab } from "../workspace/frames";
import { Activity } from "./Activity";
import { KindIcon } from "./icons";
import { TabOverflow } from "./TabOverflow";
import { FOLDED_DESC, FOLDED_TIP, TUCKED_DESC } from "./tabState";

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
  // A curated page's views live in the page tabs, so a pane's strip lists a page view only while it is shown: never a
  // repeat. The exception is a group of page views, which only a centre drop ("Add as tab") makes: you asked for
  // those tabs, so it lists each view you put there (not ones the layout folded in).
  const placed = group.tabs.filter((t) => t.node.role && !t.folded);
  const tabs = !review ? group.tabs
    : group.tabs.filter((t) => !t.node.role || t.node.id === group.active || (placed.length > 1 && !t.folded));
  // Made by you first, made by the layout (folded) after a hairline: the second kind returns by itself.
  const mine = tabs.filter((t) => !t.folded);
  const folded = tabs.filter((t) => t.folded);

  const strip = useRef<HTMLDivElement>(null);
  const [hiddenCount, setHiddenCount] = useState(0);
  const measure = () => {
    const el = strip.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    let n = 0;
    el.querySelectorAll<HTMLElement>("[data-tab]").forEach((t) => {
      const r = t.getBoundingClientRect();
      if (r.left < box.left - 1 || r.right > box.right + 1) n++;
    });
    setHiddenCount((p) => (p === n ? p : n));
    // Fade an edge that has tabs past it, so a cut-off tab reads as "more this way" (like the shelf).
    el.toggleAttribute("data-fade-l", el.scrollLeft > 1);
    el.toggleAttribute("data-fade-r", el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };
  useLayoutEffect(measure);
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const overflowing = hiddenCount > 0;

  const renderTab = ({ node: t, tucked, folded: isFolded }: Tab) => {
    const active = t.id === group.active;
    const title = titleOf(store.env, t);
    return (
      <div
        key={t.id}
        ref={active ? revealTab : undefined}
        className={`tab${active ? " is-active" : ""}${tucked ? " is-tucked" : ""}${isFolded ? " is-folded" : ""}`}
        data-tab={t.id}
        data-tucked={tucked || undefined}
        data-folded={isFolded || undefined}
        aria-label={title}
        aria-description={isFolded ? FOLDED_DESC : tucked ? TUCKED_DESC : undefined}
        title={isFolded ? `${title} · ${FOLDED_TIP}` : title}
        role="tab"
        aria-selected={active}
        aria-controls={paneDomId(store.dom.id, t.id)}
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
        <span className="tab-title" id={active ? paneTitleId(store.dom.id, owner) : undefined}>{title}</span>
        <TabActivity id={t.id} />
        {isFolded ? <span className="tab-fold-mark" aria-hidden><FoldHorizontal size={13} strokeWidth={1.75} /></span> : null}
        {tucked ? (
          <button className="tab-putback" aria-label={`Put back ${title}`} title={`Put back${shortcutLabel(store, "pane.putBack") ? ` · ${shortcutLabel(store, "pane.putBack")}` : ""}`} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); actions.putBack(t.id); }}>
            <Undo2 size={14} strokeWidth={1.75} aria-hidden />
          </button>
        ) : null}
        <button className="tab-close" aria-label={`Close ${title}`} onClick={(e) => { e.stopPropagation(); actions.close(t.id); }}>
          <X size={14} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    );
  };

  return (
    <div className="tabbar">
      <div className="tabs" ref={strip} role="tablist" aria-label={`Tabs: ${tabs.length}`} onScroll={measure}>
        {mine.map(renderTab)}
        {folded.length && mine.length ? <span className="tab-sep" aria-hidden /> : null}
        {folded.map(renderTab)}
      </div>
      {overflowing ? <TabOverflow tabs={[...mine, ...folded]} active={group.active} hiddenCount={hiddenCount} onChoose={(id) => actions.setActiveTab(group.id, id)} /> : null}
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
  const { kinds, profile } = useEnv();
  const role = useUi((s) => !!s.review) && node.role && profile ? roleOf(profile, node.role) : undefined;
  return role ? <role.icon size={14} strokeWidth={1.5} aria-hidden /> : <KindIcon kind={node.ref.kind} size={14} />;
}
