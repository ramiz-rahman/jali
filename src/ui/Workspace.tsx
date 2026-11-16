import { useEffect, useLayoutEffect, useRef } from "react";
import type { Edge, LayoutNode, PaneNode, StackNode } from "../layout-core/types";
import { PaneFrame, type StackInfo } from "./PaneFrame";
import { DividerLayer } from "./dividers/DividerLayer";
import { Peek } from "./Peek";
import { setWorkspaceEl } from "./dnd";
import { GAP, getState, hooks, resolved, setState, titleOf, useUi, bumpKinds } from "./store";
import { usePaneKindsVersion } from "./pane-kinds";
import { paneDomId } from "./ids";

function collect(node: LayoutNode, panes: Map<string, PaneNode>, stacks: Map<string, StackNode>) {
  if (node.type === "pane") panes.set(node.id, node);
  else {
    if (node.type === "stack") stacks.set(node.id, node);
    for (const c of node.children) collect(c as LayoutNode, panes, stacks);
  }
}

export function Workspace() {
  const ref = useRef<HTMLDivElement>(null);
  const layout = useUi((s) => s.layout);
  const view = useUi((s) => s.view);
  const area = useUi((s) => s.area);
  const dnd = useUi((s) => s.dnd);
  const kv = usePaneKindsVersion();
  useMemoKinds(kv);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWorkspaceEl(el);
    const measure = () => {
      const w = Math.max(0, Math.floor(el.clientWidth - GAP * 2)), h = Math.max(0, Math.floor(el.clientHeight - GAP * 2));
      const a = getState().area;
      if (a.width !== w || a.height !== h) setState({ area: { width: w, height: h } });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const r = resolved();
  const panes = new Map<string, PaneNode>(), stacks = new Map<string, StackNode>();
  collect(layout.root, panes, stacks);

  // Announce folds/unfolds from the collapse plan.
  const prevFolded = useRef<string[] | null>(null);
  useEffect(() => {
    if (prevFolded.current === null || area.width === 0) {
      prevFolded.current = r.folded;
      return;
    }
    const before = new Set(prevFolded.current), now = new Set(r.folded);
    const added = r.folded.filter((id) => !before.has(id)), removed = prevFolded.current.filter((id) => !now.has(id) && panes.has(id));
    if (added.length) hooks.announce(`${added.map(titleOf).join(", ")} folded into tabs: not enough room`);
    else if (removed.length) hooks.announce(`${removed.map(titleOf).join(", ")} unfolded: room returned`);
    prevFolded.current = r.folded;
  });

  // Keep DOM focus on the focused pane after structural changes (focus is never lost).
  useEffect(() => {
    const id = view.focused;
    if (!id) return;
    const el = document.getElementById(paneDomId(id));
    const active = document.activeElement;
    if (!el) return;
    const inPane = active && el.contains(active);
    const inOtherPane = active?.closest?.("[data-pane]") && !inPane;
    const inChrome = active?.closest?.("[role=dialog], .topbar, [data-sonner-toaster], .divider");
    // Land on the pane's grid when it has one, so J/K and Space keep working after Pin beside, close and undo.
    const target = el.querySelector<HTMLElement>("[data-autofocus]") ?? el.querySelector<HTMLElement>("[role=grid]") ?? el;
    if (!inPane && (inOtherPane || !active || active === document.body) && !inChrome) target.focus({ preventScroll: true });
    else if (inOtherPane && !inChrome) target.focus({ preventScroll: true });
  }, [view.focused, layout]);

  const stackInfo = (stackId: string | undefined): StackInfo | undefined => {
    if (!stackId) return undefined;
    const s = stacks.get(stackId);
    if (s) return { id: s.id, tabs: s.children, active: s.active };
    // Auto stacks made by resolve's collapse plan may not exist in the tree: rebuild from boxes.
    const members = r.panes.filter((b) => b.stackId === stackId);
    const active = members.find((b) => !b.hiddenInStack)?.id ?? members[0]?.id;
    return { id: stackId, tabs: members.map((b) => panes.get(b.id)!).filter(Boolean), active: active! };
  };

  const dropBox = dnd?.target ? r.panes.find((b) => b.id === dnd.target) : undefined;

  return (
    <main className="workspace" ref={ref} aria-label="Panes" data-zoomed={view.zoomed ? "" : undefined}>
      <div className="workspace-inner" style={{ left: GAP, top: GAP, width: area.width, height: area.height }}>
        {r.panes.map((box) => {
          const node = panes.get(box.id);
          if (!node) return null;
          return (
            <PaneFrame
              key={box.id}
              box={box}
              node={node}
              stack={box.hiddenInStack ? undefined : stackInfo(box.stackId)}
              focused={view.focused === box.id}
              zoomed={view.zoomed === box.id}
              covered={!!view.zoomed && view.zoomed !== box.id}
              areaWidth={area.width}
              areaHeight={area.height}
              dropTarget={dnd?.target === box.id}
            />
          );
        })}
        <DividerLayer />
        {dnd && dropBox && dnd.zone ? <DropIndicator rect={dropBox.rect} zone={dnd.zone} /> : null}
        {dnd ? (
          <div className="drag-chip" style={{ left: dnd.x + 12, top: dnd.y + 12 }} aria-hidden>
            {titleOf(dnd.dragged)}
            <span> · {dropLabel(dnd.zone, dnd.target)}</span>
          </div>
        ) : null}
        {view.zoomed ? null : null}
        <Peek />
      </div>
    </main>
  );
}

/** What releasing will do, in words, before the person lets go: "Swap with orders", "Add as tab to orders". */
export function dropLabel(zone: Edge | "centre" | undefined, target: string | undefined, mode = getState().settings.centreDrop): string {
  if (!zone || !target) return "Esc cancels";
  const t = titleOf(target);
  if (zone === "centre") return mode === "swap" ? `Swap with ${t}` : `Add as tab to ${t}`;
  return zone === "top" ? `Place above ${t}` : zone === "bottom" ? `Place below ${t}` : `Place ${zone} of ${t}`;
}

function DropIndicator({ rect, zone }: { rect: { x: number; y: number; width: number; height: number }; zone: string }) {
  let r = rect;
  if (zone === "left") r = { ...rect, width: rect.width / 2 };
  if (zone === "right") r = { ...rect, x: rect.x + rect.width / 2, width: rect.width / 2 };
  if (zone === "top") r = { ...rect, height: rect.height / 2 };
  if (zone === "bottom") r = { ...rect, y: rect.y + rect.height / 2, height: rect.height / 2 };
  return <div className={`drop-indicator zone-${zone}`} style={{ left: r.x, top: r.y, width: r.width, height: r.height }} aria-hidden />;
}

let lastKv = -1;
function useMemoKinds(kv: number) {
  if (kv !== lastKv) {
    lastKv = kv;
    bumpKinds();
  }
}
