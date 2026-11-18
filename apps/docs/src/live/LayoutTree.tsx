/**
 * The layout tree drawn as a diagram: rows, columns and stacks with their sizes, each pane with what it shows and
 * where it is now (on screen, behind a tab, folded, tucked, hidden), and the overlay under it. Reads the same store as
 * the workspace beside it, so it moves with every drag, close and fold.
 */
import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { Columns2, EyeOff, FoldHorizontal, Layers, Link2, Archive, Rows2 } from "lucide-react";
import type { LayoutNode, PaneNode, Rect, Size, WorkspaceModel } from "@jali/core";
import { KindIcon, useModel, useUi } from "@jali/react";

export interface Hover { id: string; from: "tree" | "ws" }

export const panesUnder = (n: LayoutNode): string[] => (n.type === "pane" ? [n.id] : n.children.flatMap(panesUnder));

const fmt = (v: number) => (Math.round(v * 100) / 100).toString();
export const sizeText = (s: Size) => ("px" in s ? `${fmt(s.px)}px` : `weight ${fmt(s.weight)}`);

/** Pane rects while a divider is being dragged (Jali moves the panes without a store change until release). */
export const PreviewRects = createContext<Record<string, Rect> | null>(null);

/** The box a node fills on screen: the union of its panes that are showing. */
export function extentOf(n: LayoutNode, m: WorkspaceModel, preview?: Record<string, Rect> | null): Rect | null {
  const ids = new Set(panesUnder(n));
  const boxes = m.resolved.panes.filter((b) => ids.has(b.id) && !b.hidden).map((b) => preview?.[b.id] ?? b.rect);
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((r) => r.x)), y = Math.min(...boxes.map((r) => r.y));
  const r = Math.max(...boxes.map((b) => b.x + b.width)), btm = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: r - x, height: btm - y };
}

type PaneState = { word: string; tone: "on" | "tab" | "folded" | "tucked" | "off" | "zoom"; detail?: string };

function stateOf(p: PaneNode, m: WorkspaceModel): PaneState {
  const box = m.resolved.panes.find((b) => b.id === p.id);
  if (m.off.includes(p.id)) return { word: "hidden", tone: "off", detail: "No slot and no tab" };
  const tuck = m.tuckOf(p.id);
  if (tuck) return { word: "tucked", tone: "tucked", detail: `Behind ${m.title(tuck.home)}` };
  if (m.folded.includes(p.id)) {
    const host = m.shownWith(p.id);
    return { word: "folded", tone: "folded", detail: host !== p.id ? `A tab beside ${m.title(host)}` : "Folded into a tab" };
  }
  if (box?.hidden === "tab") return { word: "tab", tone: "tab", detail: `Behind ${m.title(m.shownWith(p.id))}` };
  if (box?.hidden === "zoom") return { word: "covered", tone: "zoom", detail: "Behind the maximised pane" };
  return { word: "on screen", tone: "on" };
}

const ICON: Record<PaneState["tone"], ReactNode> = {
  on: null, zoom: null,
  tab: <Layers size={11} strokeWidth={1.75} aria-hidden />,
  folded: <FoldHorizontal size={11} strokeWidth={1.75} aria-hidden />,
  tucked: <Archive size={11} strokeWidth={1.75} aria-hidden />,
  off: <EyeOff size={11} strokeWidth={1.75} aria-hidden />,
};

interface NodeProps { node: LayoutNode; m: WorkspaceModel; hover: Hover | null; setHover(h: Hover | null): void; activeTab?: string }

/** The share of a split's length each child has now: a folded child takes none. */
function SizeBar({ node, m, hover, setHover }: NodeProps & { node: Extract<LayoutNode, { children: LayoutNode[] }> }) {
  const axis = node.type === "column" ? "height" : "width";
  const preview = useContext(PreviewRects);
  const parts = node.children.map((c) => ({ c, r: extentOf(c, m, preview) }));
  const total = parts.reduce((t, p) => t + (p.r ? p.r[axis] : 0), 0);
  if (node.type === "stack" || total <= 0) return null;
  return (
    <div className="live-tree-bar" data-axis={node.type} aria-hidden>
      {parts.map(({ c, r }) => {
        const v = r ? r[axis] : 0;
        const lit = hover && (hover.id === c.id || panesUnder(c).includes(hover.id));
        return (
          <span key={c.id} className="live-tree-seg" data-lit={lit || undefined} data-empty={!v || undefined}
            style={{ flexGrow: v, flexBasis: 0 } as CSSProperties}
            onPointerEnter={() => setHover({ id: c.id, from: "tree" })} onPointerLeave={() => setHover(null)}>
            {v >= 44 ? <i>{Math.round(v)}</i> : null}
          </span>
        );
      })}
    </div>
  );
}

function TreeNode({ node, m, hover, setHover, activeTab }: NodeProps) {
  const focused = useUi((s) => s.view.focused);
  const lit = hover?.id === node.id;
  const under = !!hover && node.type !== "pane" && hover.id !== node.id && panesUnder(node).includes(hover.id);
  const preview = useContext(PreviewRects);
  const ext = extentOf(node, m, preview);
  const live = ext ? `${Math.round(ext.width)} × ${Math.round(ext.height)}` : "not on screen";
  const enter = () => setHover({ id: node.id, from: "tree" });
  const leave = () => setHover(null);
  const rowProps = {
    className: "live-tree-row",
    "data-lit": lit || undefined,
    "data-under": under || undefined,
    "data-node": node.id,
    tabIndex: 0,
    onPointerEnter: enter, onPointerLeave: leave, onFocus: enter, onBlur: leave,
  };

  if (node.type === "pane") {
    const st = stateOf(node, m);
    const title = m.title(node.id);
    const link = node.linkedTo ? m.title(node.linkedTo) : null;
    return (
      <li className="live-tree-li" data-type="pane" data-state={st.tone}>
        <div {...rowProps} aria-label={`Pane ${title}, ${node.ref.kind}, ${sizeText(node.size)}, ${st.word}${st.detail ? `: ${st.detail}` : ""}`}>
          <span className="live-tree-glyph is-pane"><KindIcon kind={node.ref.kind} size={13} /></span>
          <span className="live-tree-main">
            <span className="live-tree-name">{title}</span>
            <span className="live-tree-sub">
              <code>{node.ref.kind}</code>
              {activeTab === node.id ? <span className="live-tree-flag">active tab</span> : null}
              {focused === node.id ? <span className="live-tree-flag is-focus">focused</span> : null}
              {link ? (
                <span className="live-tree-flag is-link" title={node.follows ? `Shows the item selected in ${link}` : `Opened from ${link}`}>
                  <Link2 size={10} strokeWidth={2} aria-hidden /> {node.follows ? "follows" : "from"} {link}
                </span>
              ) : null}
              {node.pinned ? <span className="live-tree-flag">pinned</span> : null}
            </span>
          </span>
          <span className="live-tree-size">
            <b data-user={node.userSized || undefined} title={node.userSized ? "Sized by dragging a divider" : undefined}>{sizeText(node.size)}</b>
            {st.tone === "on" ? <span>{live}</span> : (
              <span className="live-tree-state" data-tone={st.tone} title={st.detail}>{ICON[st.tone]}{st.word}</span>
            )}
          </span>
        </div>
      </li>
    );
  }

  const Glyph = node.type === "row" ? Columns2 : node.type === "column" ? Rows2 : Layers;
  const what = node.type === "row" ? "side by side" : node.type === "column" ? "one above another" : `${node.children.length} tabs`;
  return (
    <li className="live-tree-li" data-type={node.type}>
      <div {...rowProps} aria-label={`${node.type} ${node.id}: ${node.children.length} children ${what}, ${sizeText(node.size)}`}>
        <span className="live-tree-glyph"><Glyph size={13} strokeWidth={1.75} aria-hidden /></span>
        <span className="live-tree-main">
          <span className="live-tree-name"><code className="live-tree-type">{node.type}</code></span>
          <span className="live-tree-sub"><span>{what}</span></span>
        </span>
        <span className="live-tree-size">
          <b data-user={node.userSized || undefined}>{sizeText(node.size)}</b>
          <span>{live}</span>
        </span>
      </div>
      <SizeBar node={node} m={m} hover={hover} setHover={setHover} />
      <ul className="live-tree-ul">
        {node.children.map((c) => (
          <TreeNode key={c.id} node={c} m={m} hover={hover} setHover={setHover} activeTab={node.type === "stack" ? node.active : undefined} />
        ))}
      </ul>
    </li>
  );
}

function Chips({ ids, m, empty }: { ids: { id: string; note?: string }[]; m: WorkspaceModel; empty: string }) {
  if (!ids.length) return <span className="live-ov-none">{empty}</span>;
  return <>{ids.map(({ id, note }) => <span className="live-ov-chip" data-node={id} key={id}>{m.title(id)}{note ? <small>{note}</small> : null}</span>)}</>;
}

/** The overlay: what fitting and the person did on top of the tree, without changing it. */
function OverlayCard({ m }: { m: WorkspaceModel }) {
  const ov = m.layout.overlay;
  const tucks = (ov?.tucks ?? []).map((t) => ({ id: t.pane, note: `behind ${m.title(t.home)}` }));
  const shown = Object.entries(ov?.shown ?? {}).map(([home, id]) => ({ id, note: `in place of ${m.title(home)}` }));
  return (
    <div className="live-ov" aria-label="Overlay">
      <div className="live-ov-head"><span>overlay</span><small>kept beside the tree</small></div>
      <dl>
        <div><dt><FoldHorizontal size={12} strokeWidth={1.75} aria-hidden /> folded</dt><dd><Chips ids={m.folded.map((id) => ({ id }))} m={m} empty="nothing: everything fits" /></dd></div>
        <div><dt><Archive size={12} strokeWidth={1.75} aria-hidden /> tucked</dt><dd><Chips ids={tucks} m={m} empty="none" /></dd></div>
        <div><dt><EyeOff size={12} strokeWidth={1.75} aria-hidden /> hidden</dt><dd><Chips ids={m.off.map((id) => ({ id }))} m={m} empty="none" /></dd></div>
        {shown.length ? <div><dt><Layers size={12} strokeWidth={1.75} aria-hidden /> tab shown</dt><dd><Chips ids={shown} m={m} empty="none" /></dd></div> : null}
      </dl>
    </div>
  );
}

export function LayoutTree({ hover, setHover }: { hover: Hover | null; setHover(h: Hover | null): void }) {
  const m = useModel();
  return (
    <div className="live-tree">
      <ul className="live-tree-ul is-root">
        <TreeNode node={m.layout.root} m={m} hover={hover} setHover={setHover} />
      </ul>
      <OverlayCard m={m} />
    </div>
  );
}
