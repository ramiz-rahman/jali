/**
 * The layout tree drawn as a map of the workspace: a row is boxes side by side, a column is boxes stacked, tabs are
 * a box with its tabs on top. Each box takes the share of room its pane has now, so the map has the workspace's shape
 * and the tree's structure at once. A folded or tucked pane is a dashed box inside the pane it went into.
 */
import { useContext, type CSSProperties, type ReactNode } from "react";
import { Columns2, Layers, Rows2 } from "lucide-react";
import type { LayoutNode, PaneNode, StackNode, WorkspaceModel } from "@jali/core/adapter";
import { KindIcon, useWorkspaceModel } from "@jali/react";
import { PreviewRects, extentOf, panesUnder, sizeText, type Hover } from "./LayoutTree";
import { colourOf } from "./colours";

interface Ctx {
  m: WorkspaceModel;
  hover: Hover | null;
  setHover(h: Hover | null): void;
  sizes: boolean;
}

const px = (v: number) => `${Math.round(v)} px`;

/** Panes not on screen, drawn inside the pane they went into, with how they got there. */
function guestsOf(host: string, m: WorkspaceModel): { node: PaneNode; how: string }[] {
  return m.panes.flatMap((p) => {
    if (p.id === host || m.shownWith(p.id) !== host) return [];
    if (m.stackOf(p.id)) return []; // a tab of a stack is drawn by the stack
    const tuck = m.tuckOf(p.id);
    if (tuck) return [{ node: p, how: "tucked here" }];
    if (m.folded.includes(p.id)) return [{ node: p, how: "folded in here" }];
    return [];
  });
}

/** Hover and focus are handled once, on the map: the innermost box under the pointer or holding focus is the one. */
function hoverProps(id: string, c: Ctx, label: string) {
  return {
    "data-node": id,
    "data-lit": c.hover?.id === id || undefined,
    tabIndex: 0,
    "aria-label": label,
  };
}

/** What a pane is doing, in a few plain words. */
function roleWords(p: PaneNode, m: WorkspaceModel): string | null {
  const leads = m.panes.find((q) => q.linkedTo === p.id && q.follows);
  if (p.linkedTo && p.follows) return `follows ${m.title(p.linkedTo)}`;
  if (p.linkedTo) return `opened from ${m.title(p.linkedTo)}`;
  if (leads) return `picks what ${m.title(leads.id)} shows`;
  return null;
}

function Guest({ node, how, c }: { node: PaneNode; how: string; c: Ctx }) {
  const title = c.m.title(node.id);
  return (
    <div
      className="live-map-guest"
      style={{ "--c": colourOf(node.id), "--live-id": colourOf(node.id) } as CSSProperties}
      {...hoverProps(node.id, c, `${title}, ${how}`)}
    >
      <KindIcon kind={node.ref.kind} size={14} />
      <span className="live-map-guest-name">{title}</span>
      <span className="live-map-guest-how">{how}</span>
    </div>
  );
}

function PaneBox({ node, c, inStack }: { node: PaneNode; c: Ctx; inStack?: boolean }) {
  const preview = useContext(PreviewRects);
  const title = c.m.title(node.id);
  const ext = extentOf(node, c.m, preview);
  const role = roleWords(node, c.m);
  const guests = guestsOf(node.id, c.m);
  const lit = c.hover?.id === node.id;
  const size = ext ? `${px(ext.width)} wide` : "";
  return (
    <div
      className="live-map-pane"
      data-in-stack={inStack || undefined}
      style={{ "--c": colourOf(node.id), "--live-id": colourOf(node.id) } as CSSProperties}
      {...hoverProps(
        node.id,
        c,
        `Pane: ${title}${role ? `, ${role}` : ""}${size ? `, ${size}` : ""}`,
      )}
    >
      <div className="live-map-pane-head">
        <KindIcon kind={node.ref.kind} size={15} />
        <span className="live-map-pane-name">{title}</span>
      </div>
      {role ? <div className="live-map-pane-role">{role}</div> : null}
      {c.sizes || lit ? (
        <div className="live-map-size">
          {size}
          {c.sizes ? <span>{sizeText(node.size)}</span> : null}
        </div>
      ) : null}
      {guests.length ? null : (
        <div className="live-map-sketch" data-kind={node.ref.kind} aria-hidden />
      )}
      {guests.length ? (
        <div className="live-map-guests">
          {guests.map((g) => (
            <Guest key={g.node.id} node={g.node} how={g.how} c={c} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StackBox({ node, c }: { node: StackNode; c: Ctx }) {
  const shown = c.m.shownWith(node.active);
  const active =
    node.children.find((t) => t.id === shown) ??
    node.children.find((t) => t.id === node.active) ??
    node.children[0]!;
  return (
    <div
      className="live-map-split live-map-stack"
      {...hoverProps(node.id, c, `Tabs: ${node.children.length} panes share one place`)}
    >
      <div className="live-map-label">
        <Layers size={13} strokeWidth={1.75} aria-hidden />
        <b>Tabs</b>
        <span>{node.children.length} panes share one place</span>
      </div>
      <div className="live-map-tabs">
        {node.children.map((t) => (
          <span
            key={t.id}
            className="live-map-tab"
            data-active={t.id === active.id || undefined}
            style={{ "--c": colourOf(t.id) } as CSSProperties}
            {...hoverProps(
              t.id,
              c,
              `Tab: ${c.m.title(t.id)}${t.id === active.id ? ", showing" : ""}`,
            )}
          >
            {c.m.title(t.id)}
          </span>
        ))}
      </div>
      <PaneBox node={active} c={c} inStack />
    </div>
  );
}

function SplitBox({ node, c }: { node: Extract<LayoutNode, { type: "row" | "column" }>; c: Ctx }) {
  const preview = useContext(PreviewRects);
  const row = node.type === "row";
  const axis = row ? "width" : "height";
  const kids = node.children.map((k) => ({ k, r: extentOf(k, c.m, preview) })).filter((x) => x.r);
  const ext = extentOf(node, c.m, preview);
  const lit = c.hover?.id === node.id;
  const under = !!c.hover && !lit && panesUnder(node).includes(c.hover.id);
  const Glyph = row ? Columns2 : Rows2;
  const words = row ? "side by side" : "one above the other";
  return (
    <div
      className="live-map-split"
      data-axis={node.type}
      data-under={under || undefined}
      {...hoverProps(node.id, c, `${row ? "Row" : "Column"}: ${kids.length} ${words}`)}
    >
      <div className="live-map-label">
        <Glyph size={13} strokeWidth={1.75} aria-hidden />
        <b>{row ? "Row" : "Column"}</b>
        <span>{words}</span>
        {(c.sizes || lit) && ext ? (
          <i>
            {px(ext.width)} × {px(ext.height)}
          </i>
        ) : null}
      </div>
      <div className="live-map-kids" data-axis={node.type}>
        {kids.map(({ k, r }) => (
          <div key={k.id} className="live-map-cell" style={{ flexGrow: r![axis], flexBasis: 0 }}>
            <MapNode node={k} c={c} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MapNode({ node, c }: { node: LayoutNode; c: Ctx }): ReactNode {
  if (node.type === "pane") return <PaneBox node={node} c={c} />;
  if (node.type === "stack") return <StackBox node={node} c={c} />;
  return <SplitBox node={node} c={c} />;
}

export function LayoutMap({
  hover,
  setHover,
  sizes,
}: {
  hover: Hover | null;
  setHover(h: Hover | null): void;
  sizes: boolean;
}) {
  const m = useWorkspaceModel();
  const pick = (e: { target: EventTarget }) => {
    const id = (e.target as Element).closest<HTMLElement>("[data-node]")?.dataset.node;
    if (id && id !== hover?.id) setHover({ id, from: "tree" });
  };
  return (
    <div
      className="live-map"
      data-sizes={sizes || undefined}
      onPointerOver={pick}
      onFocus={pick}
      onPointerLeave={() => setHover(null)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHover(null);
      }}
    >
      <MapNode node={m.layout.root} c={{ m, hover, setHover, sizes }} />
    </div>
  );
}
