/**
 * Shared pieces of the tree view: which panes sit under a node, the box a node fills now, sizes as text, and the
 * overlay card (what fitting and the person did on top of the tree, without changing it).
 */
import { createContext, type CSSProperties } from "react";
import {
  ArchiveIcon,
  ArrowsInLineHorizontalIcon,
  EyeSlashIcon,
  StackIcon,
} from "@phosphor-icons/react";
import type { LayoutNode, Rect, Size, JaliModel } from "jali";
import { colourOf } from "./colours";

export interface Hover {
  id: string;
  from: "tree" | "ws";
}

export const panesUnder = (n: LayoutNode): string[] =>
  n.type === "pane" ? [n.id] : n.children.flatMap(panesUnder);

const fmt = (v: number) => (Math.round(v * 100) / 100).toString();
export const sizeText = (s: Size) =>
  "px" in s ? `${fmt(s.px)} px fixed` : `weight ${fmt(s.weight)}`;

/** Pane rects while a divider is being dragged (Jali moves the panes without a store change until release). */
export const PreviewRects = createContext<Record<string, Rect> | null>(null);

/** The box a node fills on screen: the union of its panes that are showing. */
export function extentOf(
  n: LayoutNode,
  m: JaliModel,
  preview?: Record<string, Rect> | null,
): Rect | null {
  const ids = new Set(panesUnder(n));
  const boxes = m.resolved.panes
    .filter((b) => ids.has(b.id) && !b.hidden)
    .map((b) => preview?.[b.id] ?? b.rect);
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((r) => r.x)),
    y = Math.min(...boxes.map((r) => r.y));
  const r = Math.max(...boxes.map((b) => b.x + b.width)),
    btm = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: r - x, height: btm - y };
}

function Chips({
  ids,
  m,
  empty,
}: {
  ids: { id: string; note?: string }[];
  m: JaliModel;
  empty: string;
}) {
  if (!ids.length) return <span className="live-ov-none">{empty}</span>;
  return (
    <>
      {ids.map(({ id, note }) => (
        <span
          className="live-ov-chip"
          data-node={id}
          key={id}
          style={{ "--c": colourOf(id) } as CSSProperties}
        >
          {m.title(id)}
          {note ? <small>{note}</small> : null}
        </span>
      ))}
    </>
  );
}

/** The overlay: kept beside the tree, so folding and tucking never rewrite the layout the person made. */
export function OverlayCard({ m }: { m: JaliModel }) {
  const ov = m.layout.overlay;
  const tucks = (ov?.tucks ?? []).map((t) => ({ id: t.pane, note: `behind ${m.title(t.home)}` }));
  const shown = Object.entries(ov?.shown ?? {}).map(([home, id]) => ({
    id,
    note: home !== id ? `in place of ${m.title(home)}` : undefined,
  }));
  return (
    <div className="live-ov" aria-label="Overlay">
      <div className="live-ov-head">
        <span>Overlay</span>
        <small>kept beside the tree, never in it</small>
      </div>
      <dl>
        <div>
          <dt>
            <ArrowsInLineHorizontalIcon size={13} aria-hidden /> Folded
          </dt>
          <dd>
            <Chips ids={m.folded.map((id) => ({ id }))} m={m} empty="nothing: everything fits" />
          </dd>
        </div>
        <div>
          <dt>
            <ArchiveIcon size={13} aria-hidden /> Tucked
          </dt>
          <dd>
            <Chips ids={tucks} m={m} empty="none" />
          </dd>
        </div>
        <div>
          <dt>
            <EyeSlashIcon size={13} aria-hidden /> Hidden
          </dt>
          <dd>
            <Chips ids={m.off.map((id) => ({ id }))} m={m} empty="none" />
          </dd>
        </div>
        {shown.length ? (
          <div>
            <dt>
              <StackIcon size={13} aria-hidden /> Tab shown
            </dt>
            <dd>
              <Chips ids={shown} m={m} empty="none" />
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
