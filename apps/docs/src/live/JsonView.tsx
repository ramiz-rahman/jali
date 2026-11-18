/**
 * The layout as JSON: pretty, highlighted, numbered and live. It is drawn as lines, so a highlight is a full-width
 * band across a run of lines, gutter and number included:
 *  - hovering a node's lines lights its pane and its box, and the node's lines take the pane's colour;
 *  - the lines that changed with the last change (a click, a drag, a close, a fold) take a brief Nil band that fades.
 */
import { useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { colourOf } from "./colours";
import type { Hover } from "./LayoutTree";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const isObj = (v: Json | undefined): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const isNode = (v: Json | undefined): v is Obj => isObj(v) && typeof v.id === "string" && typeof v.type === "string";
const text = (v: Json | undefined) => (v === undefined ? "" : JSON.stringify(v));
const inline = (v: Json, limit: number) => !isNode(v) && text(v).length <= limit && !text(v).includes('"type"');

/** The value a part of the new layout is compared with: by key in objects, by node id in lists of nodes. */
function before(prev: Json | undefined, v: Json, key: string | number): Json | undefined {
  if (Array.isArray(prev) && typeof key === "number") return isNode(v) ? prev.find((p) => isNode(p) && p.id === v.id) : prev[key];
  return isObj(prev) && typeof key === "string" ? prev[key] : undefined;
}

function Scalar({ v }: { v: Json }) {
  if (typeof v === "string") return <span className="j-str">{JSON.stringify(v)}</span>;
  if (typeof v === "number") return <span className="j-num">{v}</span>;
  if (typeof v === "boolean" || v === null) return <span className="j-bool">{String(v)}</span>;
  return null;
}

function Inline({ v }: { v: Json }): ReactNode {
  if (Array.isArray(v)) return <>[{v.map((x, i) => <span key={i}>{i ? ", " : ""}<Inline v={x} /></span>)}]</>;
  if (isObj(v)) {
    const ks = Object.keys(v);
    if (!ks.length) return "{}";
    return <>{"{ "}{ks.map((k, i) => <span key={k}>{i ? ", " : ""}<span className="j-key">"{k}"</span>: <Inline v={v[k]!} /></span>)}{" }"}</>;
  }
  return <Scalar v={v} />;
}

/** One line: its text, the nodes it belongs to (innermost last), and whether it changed. */
interface LineOut { body: ReactNode; nodes: string[]; changed: boolean }

function emit(out: LineOut[], v: Json, prev: Json | undefined, depth: number, label: string | null, last: boolean, nodes: string[], forced: boolean, live: boolean, limit: number) {
  const pad = "  ".repeat(depth);
  const key = label === null ? null : <><span className="j-key">"{label}"</span>: </>;
  const comma = last ? "" : ",";
  const differs = live && text(v) !== text(prev);
  const small = inline(v, limit) || typeof v !== "object" || v === null;
  // A value that is new, or small, is marked whole; a larger one that changed marks only its own changed lines.
  const whole = forced || (differs && (prev === undefined || small));
  if (small) {
    out.push({ body: <>{pad}{key}<Inline v={v} />{comma}</>, nodes, changed: whole });
    return;
  }
  const own = isNode(v) ? [...nodes, v.id as string] : nodes;
  const open = Array.isArray(v) ? "[" : "{", close = Array.isArray(v) ? "]" : "}";
  out.push({ body: <>{pad}{key}{open}</>, nodes: own, changed: whole });
  if (Array.isArray(v)) v.forEach((x, i) => emit(out, x, before(prev, x, i), depth + 1, null, i === v.length - 1, own, whole, live, limit));
  else {
    const ks = Object.keys(v);
    ks.forEach((k, i) => emit(out, v[k]!, before(prev, v[k]!, k), depth + 1, k, i === ks.length - 1, own, whole, live, limit));
  }
  out.push({ body: <>{pad}{close}{comma}</>, nodes: own, changed: whole });
}

export function JsonView({ value, hover, setHover, label, compact = false }: { value: unknown; hover: Hover | null; setHover(h: Hover | null): void; label: string; /** A narrow column: only the smallest values stay on one line. */ compact?: boolean }) {
  // The layout before the last change, so the lines that changed can be marked; a new stamp restarts the band.
  // Changes that land together (an order, then its customer a moment later) are one change: the baseline stays.
  const track = useRef<{ value: unknown; prev: Json | undefined; stamp: number; at: number }>({ value: undefined, prev: undefined, stamp: 0, at: 0 });
  const t = track.current;
  const v = useMemo(() => JSON.parse(JSON.stringify(value)) as Json, [value]);
  if (t.value !== value) {
    if (t.value !== undefined) {
      const now = Date.now();
      if (now - t.at > 700 || t.prev === undefined) t.prev = JSON.parse(JSON.stringify(t.value)) as Json;
      t.at = now;
      t.stamp++;
    }
    t.value = value;
  }
  const stamp = t.stamp;
  const lines = useMemo(() => {
    const out: LineOut[] = [];
    emit(out, v, track.current.prev ?? v, 0, null, true, [], false, stamp > 0, compact ? 18 : 34);
    return out;
  }, [v, stamp, compact]);
  const pre = useRef<HTMLPreElement>(null);
  // Bring the first changed line into view, inside the panel only (never the page).
  useLayoutEffect(() => {
    const el = pre.current;
    if (!el || !stamp) return;
    const line = el.querySelector<HTMLElement>("[data-changed]");
    if (!line) return;
    const top = line.offsetTop, bottom = top + line.offsetHeight;
    if (top < el.scrollTop + 8 || bottom > el.scrollTop + el.clientHeight - 8) el.scrollTo({ top: Math.max(0, top - el.clientHeight / 3), behavior: "smooth" });
  }, [stamp]);
  const width = String(lines.length).length;
  return (
    <pre className="live-json" ref={pre} tabIndex={0} aria-label={label} style={{ "--gutter": `${width + 1.5}ch` } as CSSProperties}
      onPointerOver={(e) => {
        const id = (e.target as Element).closest<HTMLElement>("[data-node]")?.dataset.node;
        if (id && id !== hover?.id) setHover({ id, from: "tree" });
      }}
      onPointerLeave={() => setHover(null)}>
      <code>
        {lines.map((l, i) => {
          const node = l.nodes[l.nodes.length - 1];
          const lit = !!hover && l.nodes.includes(hover.id);
          return (
            <span key={l.changed ? `${i}-${stamp}` : i} className="j-row" data-node={node} data-lit={lit || undefined} data-changed={l.changed || undefined}
              style={lit ? ({ "--c": colourOf(hover!.id) } as CSSProperties) : undefined}>
              <span className="j-ln" aria-hidden>{i + 1}</span>
              <span className="j-text">{l.body}</span>
            </span>
          );
        })}
      </code>
    </pre>
  );
}
