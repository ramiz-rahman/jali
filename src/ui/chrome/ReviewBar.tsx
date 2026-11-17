import { useRef, type KeyboardEvent } from "react";
import { Columns2, RotateCcw, Square, Undo2 } from "lucide-react";
import { investigation } from "../actions/review";
import { getProfile } from "../profile";
import { useModel, useStore, useUi } from "../state/react";
import { Workspace } from "../workspace/Workspace";
import { startTabDrag } from "../workspace/dnd";

/**
 * A curated page's controls in the top bar: the mode (Single or Multiplexed), the investigation (panes opened from
 * links) with its way back, and Reset for the multiplexed layout. Which views are on screen is the tabs' job.
 */
export function ReviewBar() {
  const review = useUi((s) => s.review);
  const m = useModel();
  const { actions } = useStore();
  if (!getProfile() || !review) return null;
  const opened = investigation(m.panes).length;
  const multi = review.mode === "multi";
  return (
    <div className="review-bar">
      <div className="seg mode-switch" role="radiogroup" aria-label="View mode">
        <button role="radio" aria-checked={!multi} className="seg-btn" onClick={() => actions.setMode("single")} title="One view at a time">
          <Square size={14} strokeWidth={1.5} aria-hidden /> Single
        </button>
        <button role="radio" aria-checked={multi} className="seg-btn" onClick={() => actions.setMode("multi")} disabled={!review.canInvestigate}
          title={review.canInvestigate ? "Views side by side: drag tabs into the layout" : "Your role works in Single"}>
          <Columns2 size={14} strokeWidth={1.5} aria-hidden /> Multiplexed
        </button>
      </div>
      {multi && opened ? (
        <div className="inv" role="group" aria-label="Investigation">
          <span className="inv-mark" aria-hidden />
          <span className="inv-text">Investigating · <b>{opened}</b> opened</span>
          <button className="inv-back" onClick={() => actions.backToReview()}>
            <Undo2 size={13} strokeWidth={1.75} aria-hidden /> Back to review
          </button>
        </div>
      ) : null}
      {multi ? (
        <button className="icon-btn review-reset" onClick={() => actions.resetReview()} aria-label="Reset layout to its design" title="Reset layout · drops your multiplexed layout">
          <RotateCcw size={15} strokeWidth={1.5} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/**
 * The page's tabs. Single: one is selected, the view on screen. Multiplexed: the tabs are a palette of views; each is
 * marked focused, on screen or not, and dragging one into the panes places it there. ⌥-click opens a view beside.
 */
function PageTabs() {
  const p = getProfile()!;
  const store = useStore();
  const { actions } = store;
  const review = useUi((s) => s.review)!;
  const focused = useUi((s) => s.view.focused);
  const m = useModel();
  const strip = useRef<HTMLDivElement>(null);
  // The drag a pointer-down started: a click that ends a drag is not a click.
  const drag = useRef<{ dragged(): boolean } | null>(null);
  const multi = review.mode === "multi";
  const state = (id: string) => {
    if (!multi) return id === review.tab ? "focused" : "off";
    if (m.pane(focused)?.role === id) return "focused";
    return m.visible.includes(id) ? "shown" : m.off.includes(id) ? "off" : "behind";
  };
  const selected = multi ? (m.pane(focused)?.role ?? review.tab) : review.tab;
  const keys = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const tabs = [...(strip.current?.querySelectorAll<HTMLElement>("[role=tab]") ?? [])];
    const i = tabs.indexOf(document.activeElement as HTMLElement);
    tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length]?.focus();
    e.preventDefault();
  };
  return (
    <div className="page-tabs" role="tablist" aria-label={`${p.name} views`} ref={strip} onKeyDown={keys}>
      {p.roles.map((r) => {
        const st = state(r.id);
        const Icon = r.icon;
        return (
          <button key={r.id} role="tab" className="page-tab" data-role={r.id} data-state={st}
            aria-selected={r.id === selected} tabIndex={r.id === selected ? 0 : -1}
            aria-description={multi ? (st === "off" ? "Not on screen" : st === "behind" ? "Behind another tab" : "On screen") : undefined}
            title={multi ? (st === "off" || st === "behind" ? `Show ${r.label} · drag it to place it · ⌥-click: beside` : `Focus ${r.label} · drag to move it`) : `${r.label} · drag or ⌥-click to see it beside`}
            onPointerDown={(e) => { drag.current = startTabDrag(store, e, r.id, r.label); }}
            onClick={(e) => {
              if (drag.current?.dragged()) return;
              if (e.altKey) actions.openTabBeside(r.id);
              else actions.openTab(r.id);
            }}>
            <Icon size={14} strokeWidth={1.5} aria-hidden />
            <span>{r.label}</span>
            {multi && st === "shown" ? <span className="page-tab-dot" aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** The curated page: the queue at the left; the item's header, its tabs and the panes at the right. */
export function ReviewPage() {
  const p = getProfile()!;
  const item = useUi((s) => s.review!.item);
  const { actions } = useStore();
  return (
    <div className="review-page">
      <p.Rail item={item} activate={actions.activate} />
      <div className="review-main">
        <p.Header item={item} />
        <PageTabs />
        <Workspace />
      </div>
    </div>
  );
}

/** Data Studio or a curated page: the lab shows both so the two control models can be compared. */
export function AppSwitch() {
  const p = getProfile();
  const inReview = useUi((s) => !!s.review);
  const { actions } = useStore();
  if (!p) return <span className="brand-name">Pane lab</span>;
  return (
    <div className="app-switch" role="radiogroup" aria-label="Workspace">
      <button role="radio" aria-checked={!inReview} className="app-btn" onClick={() => inReview && actions.leaveReview()}>Data Studio</button>
      <button role="radio" aria-checked={inReview} className="app-btn" onClick={() => !inReview && actions.enterReview()}>{p.name}</button>
    </div>
  );
}
