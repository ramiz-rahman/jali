import { memo, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronsLeft, ChevronsRight, ChevronsDown, Maximize2, Minimize2, Square, X, GripHorizontal } from "lucide-react";
import type { ObjectRef, PaneBox, PaneNode } from "../layout-core/types";
import { getPaneKind, paneTitle, type PaneActivity, type PaneComponentProps } from "./pane-kinds";
import { actions, getState, useUi } from "./store";
import { startPaneDrag } from "./dnd";
import { paneDomId, paneTitleId } from "./ids";

const ACTIVITY_LABEL: Record<PaneActivity, string> = {
  idle: "",
  loading: "Loading",
  working: "Working",
  "needs-you": "Needs you",
  error: "Error",
};

export function ActivityDot({ a }: { a: PaneActivity | undefined }) {
  if (!a || a === "idle") return null;
  return <span className={`activity activity-${a}`} title={ACTIVITY_LABEL[a]} aria-label={ACTIVITY_LABEL[a]} role="img" />;
}

export function KindIcon({ kind, size = 16 }: { kind: string; size?: number }) {
  const Icon = getPaneKind(kind)?.icon ?? Square;
  return <Icon size={size} strokeWidth={1.5} aria-hidden />;
}

/** The pane's content. Memoised on what the kind actually sees, so divider drags don't re-render content. */
const PaneBody = memo(
  function PaneBody(p: { node: PaneNode; paused: boolean; focused: boolean; holding: boolean; inPeek?: boolean }) {
    const def = getPaneKind(p.node.ref.kind);
    const id = p.node.id;
    const props = useMemo(() => {
      // Inside the peek sheet, actions act for the pane the peek came from.
      const src = () => (id === "peek" ? (getState().peekSource ?? getState().view.focused ?? id) : id);
      return {
        openBeside: (ref: ObjectRef) => actions.openBeside(src(), ref),
        peek: (ref: ObjectRef | null) => actions.peek(ref, src()),
        select: (ref: ObjectRef | null) => actions.select(src(), ref),
        setActivity: (a: PaneActivity) => {
          if (id !== "peek") actions.setActivity(id, a);
        },
      };
    }, [id]);
    if (!def) {
      return (
        <div className="pane-missing" role="alert">
          <strong>Unknown pane kind “{p.node.ref.kind}”.</strong>
          <span>This pane stays in place so the layout keeps its shape. Close it or reset the layout from ⌘K.</span>
        </div>
      );
    }
    const C = def.Component as (props: PaneComponentProps) => React.ReactNode;
    return (
      <C
        node={p.node}
        ref={p.node.ref}
        paused={p.paused}
        focused={p.focused}
        holding={p.holding}
        inPeek={!!p.inPeek}
        {...props}
      />
    );
  },
  (a, b) =>
    a.node.id === b.node.id &&
    a.paused === b.paused &&
    a.focused === b.focused &&
    a.holding === b.holding &&
    a.node.linkedTo === b.node.linkedTo &&
    a.node.pinned === b.node.pinned &&
    a.node.collapsed === b.node.collapsed &&
    JSON.stringify(a.node.ref) === JSON.stringify(b.node.ref),
);
export { PaneBody };

export interface StackInfo {
  id: string;
  tabs: PaneNode[];
  active: string;
}

interface Props {
  box: PaneBox;
  node: PaneNode;
  stack?: StackInfo;
  focused: boolean;
  zoomed: boolean;
  covered: boolean;
  areaWidth: number;
  areaHeight: number;
  dropTarget: boolean;
}

export const PaneFrame = memo(function PaneFrame({ box, node, stack, focused, zoomed, covered, areaWidth, areaHeight, dropTarget }: Props) {
  const activity = useUi((s) => s.activity[node.id]);
  const dividerDrag = useUi((s) => s.dividerDrag);
  const isDragged = useUi((s) => s.dnd?.dragged === node.id);
  const def = getPaneKind(node.ref.kind);
  const title = paneTitle(node.ref);
  const hidden = !!box.hiddenInStack;
  const rect = zoomed ? { x: 0, y: 0, width: areaWidth, height: areaHeight } : box.rect;
  const collapsed = !!node.collapsed && !zoomed;
  const rail = collapsed && rect.width <= 72;
  const paused = hidden || collapsed || covered;
  const holding = dividerDrag && !!def?.heavy;

  // Heavy panes hold their content at the size it had when the drag began, and reflow on release.
  const contentRef = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    if (holding && contentRef.current) {
      const r = contentRef.current.getBoundingClientRect();
      setHeld({ width: r.width, height: r.height });
    } else setHeld(null);
  }, [holding]);

  const style: CSSProperties = {
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
    display: hidden ? "none" : undefined,
  };
  const onLeft = rect.x + rect.width / 2 < areaWidth / 2;

  const regionProps = {
    id: paneDomId(node.id),
    role: "region" as const,
    "aria-labelledby": paneTitleId(node.id),
    tabIndex: -1,
    "data-pane": node.id,
    "data-kind": node.ref.kind,
    "data-focused": focused || undefined,
    "aria-hidden": covered || undefined,
    inert: covered || undefined,
    onPointerDownCapture: () => actions.focus(node.id),
    onFocusCapture: () => {
      if (getState().view.focused !== node.id) actions.focus(node.id);
    },
  };

  const cls = ["pane", rail && "pane-rail", focused && "is-focused", zoomed && "is-zoomed", collapsed && "is-collapsed", isDragged && "is-dragged", dropTarget && "is-drop-target"]
    .filter(Boolean)
    .join(" ");

  return (
    <section {...regionProps} className={cls} style={style}>
      {rail ? (
        <div className="rail">
          <button className="rail-restore" onClick={() => actions.setCollapsed(node.id, false)} aria-label={`Restore ${title}`} title={`Restore ${title} (⌥⌘M)`}>
            {onLeft ? <ChevronsRight size={16} strokeWidth={1.5} aria-hidden /> : <ChevronsLeft size={16} strokeWidth={1.5} aria-hidden />}
          </button>
          <span className="rail-icon">
            <KindIcon kind={node.ref.kind} />
          </span>
          <span className="rail-title" id={paneTitleId(node.id)}>
            {title}
          </span>
          <ActivityDot a={activity} />
        </div>
      ) : (
      <header
        className={`pane-header${collapsed ? " is-strip" : ""}`}
        onPointerDown={(e) => startPaneDrag(e, node.id)}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          actions.toggleZoom(node.id);
        }}
      >
        <span className="grip" aria-hidden>
          <GripHorizontal size={14} strokeWidth={1.5} />
        </span>
        {stack ? (
          <div className="tabs" role="tablist" aria-label={`Tabs: ${stack.tabs.length}`}>
            {stack.tabs.map((t) => {
              const active = t.id === stack.active;
              return (
                <div
                  key={t.id}
                  ref={active ? revealTab : undefined}
                  className={`tab${active ? " is-active" : ""}`}
                  role="tab"
                  aria-selected={active}
                  aria-controls={paneDomId(t.id)}
                  tabIndex={active ? 0 : -1}
                  data-drag-ok
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startPaneDrag(e, t.id);
                  }}
                  onClick={() => actions.setActiveTab(stack.id, t.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      actions.setActiveTab(stack.id, t.id);
                    }
                  }}
                >
                  <KindIcon kind={t.ref.kind} size={14} />
                  <span className="tab-title" id={active ? paneTitleId(node.id) : undefined}>
                    {paneTitle(t.ref)}
                  </span>
                  <TabActivity id={t.id} />
                  <button className="tab-close" aria-label={`Close ${paneTitle(t.ref)}`} onClick={(e) => { e.stopPropagation(); actions.close(t.id); }}>
                    <X size={12} strokeWidth={1.75} aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="pane-title">
            <KindIcon kind={node.ref.kind} />
            <h2 id={paneTitleId(node.id)}>{title}</h2>
            <ActivityDot a={activity} />
            {node.pinned ? <span className="badge">Pinned</span> : null}
          </div>
        )}
        <div className="pane-actions">
          <button
            className="icon-btn act-zoom"
            onClick={() => actions.toggleZoom(node.id)}
            aria-label={zoomed ? `Restore ${title}` : `Maximise ${title}`}
            aria-pressed={zoomed}
            title={zoomed ? "Restore (Esc)" : "Maximise (⇧⌘↵)"}
          >
            {zoomed ? <Minimize2 size={14} strokeWidth={1.5} aria-hidden /> : <Maximize2 size={14} strokeWidth={1.5} aria-hidden />}
          </button>
          {!zoomed ? (
            <button
              className="icon-btn act-min"
              onClick={() => actions.setCollapsed(node.id)}
              aria-label={collapsed ? `Restore ${title}` : `Minimise ${title}`}
              aria-pressed={collapsed}
              title={collapsed ? "Restore (⌥⌘M)" : "Minimise (⌥⌘M)"}
            >
              {collapsed ? <ChevronsDown size={14} strokeWidth={1.5} aria-hidden /> : onLeft ? <ChevronsLeft size={14} strokeWidth={1.5} aria-hidden /> : <ChevronsRight size={14} strokeWidth={1.5} aria-hidden />}
            </button>
          ) : null}
          <button className="icon-btn act-close" onClick={() => actions.close(node.id)} aria-label={`Close ${title}`} title="Close (⌥⌘W)">
            <X size={14} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </header>
      )}
      {/* Same element in rail and full modes, so content (and its state) survives minimise/restore. */}
      <div className="pane-content" ref={contentRef} hidden={collapsed} data-holding={holding || undefined}>
        <div className="pane-content-inner" style={held ? { width: held.width, height: held.height } : undefined}>
          <PaneBody node={node} paused={paused} focused={focused} holding={holding} />
        </div>
      </div>
    </section>
  );
});

/** Keep the active tab visible by scrolling only the tab strip (scrollIntoView would also move the workspace). */
function revealTab(el: HTMLDivElement | null) {
  const strip = el?.parentElement;
  if (!el || !strip) return;
  if (el.offsetLeft < strip.scrollLeft) strip.scrollLeft = el.offsetLeft;
  else if (el.offsetLeft + el.offsetWidth > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = el.offsetLeft + el.offsetWidth - strip.clientWidth;
}

function TabActivity({ id }: { id: string }) {
  const a = useUi((s) => s.activity[id]);
  return <ActivityDot a={a} />;
}
