/**
 * The layout as JSON: pretty, highlighted, and live. Each node's object is marked, so hovering it lights its pane
 * and its box. The lines that changed with the last change (a click, a drag, a close, a fold) take a brief Nil tint.
 */
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { colourOf } from "./colours";
import type { Hover } from "./LayoutTree";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const isObj = (v: Json | undefined): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const isNode = (v: Json | undefined): v is Obj => isObj(v) && typeof v.id === "string" && typeof v.type === "string";
const text = (v: Json | undefined) => (v === undefined ? "" : JSON.stringify(v));
/** Small leaves (a size, a ref) stay on one line. */
const inline = (v: Json, limit: number) => !isNode(v) && text(v).length <= limit && !text(v).includes('"type"');

/** The value a part of the new layout is compared with: by key in objects, by node id in lists of nodes. */
function before(prev: Json | undefined, v: Json, key: string | number): Json | undefined {
  if (Array.isArray(prev) && typeof key === "number") {
    return isNode(v) ? prev.find((p) => isNode(p) && p.id === v.id) : prev[key];
  }
  return isObj(prev) && typeof key === "string" ? prev[key] : undefined;
}

interface R { hover: Hover | null; stamp: number; live: boolean; limit: number }

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

/**
 * One line (or one block) of the JSON. `changed`: this part is new or different since the last change, and is
 * small enough to mark whole; a larger block that changed marks only its own changed lines inside it.
 */
function Line({ pad, label, v, prev, last, depth, r }: { pad: string; label: ReactNode; v: Json; prev: Json | undefined; last: boolean; depth: number; r: R }) {
  const differs = r.live && text(v) !== text(prev);
  const whole = differs && (prev === undefined || inline(v, r.limit) || typeof v !== "object" || v === null);
  return (
    <span className="j-line" data-changed={whole || undefined} key={whole ? r.stamp : undefined}>
      {pad}{label}<Value v={v} prev={whole ? v : prev} depth={depth} r={r} />{last ? "" : ","}{"\n"}
    </span>
  );
}

function Value({ v, prev, depth, r }: { v: Json; prev: Json | undefined; depth: number; r: R }): ReactNode {
  if (inline(v, r.limit) || typeof v !== "object" || v === null) return <Inline v={v} />;
  const pad = "  ".repeat(depth + 1), end = "  ".repeat(depth);
  if (Array.isArray(v)) {
    return <>[{"\n"}{v.map((x, i) => (
      <Line key={isNode(x) ? (x.id as string) : i} pad={pad} label={null} v={x} prev={before(prev, x, i)} last={i === v.length - 1} depth={depth + 1} r={r} />
    ))}{end}]</>;
  }
  const ks = Object.keys(v);
  const body = <>{"{"}{"\n"}{ks.map((k, i) => (
    <Line key={k} pad={pad} label={<><span className="j-key">"{k}"</span>: </>} v={v[k]!} prev={before(prev, v[k]!, k)} last={i === ks.length - 1} depth={depth + 1} r={r} />
  ))}{end}{"}"}</>;
  if (!isNode(v)) return body;
  const id = v.id as string;
  return <span className="j-node" data-node={id} data-lit={r.hover?.id === id || undefined} style={{ "--c": colourOf(id) } as CSSProperties}>{body}</span>;
}

export function JsonView({ value, hover, setHover, label, compact = false }: { value: unknown; hover: Hover | null; setHover(h: Hover | null): void; label: string; /** A narrow column: only the smallest values stay on one line. */ compact?: boolean }) {
  // The layout before the last change, so the lines that changed can be marked; a new stamp restarts the tint.
  const track = useRef<{ value: unknown; prev: Json | undefined; stamp: number }>({ value: undefined, prev: undefined, stamp: 0 });
  const t = track.current;
  const v = useMemo(() => JSON.parse(JSON.stringify(value)) as Json, [value]);
  if (t.value !== value) {
    if (t.value !== undefined) { t.prev = JSON.parse(JSON.stringify(t.value)) as Json; t.stamp++; }
    t.value = value;
  }
  const pre = useRef<HTMLPreElement>(null);
  // Bring the first changed line into view, inside the panel only (never the page).
  useLayoutEffect(() => {
    const el = pre.current;
    if (!el || !t.stamp) return;
    const line = el.querySelector<HTMLElement>("[data-changed]");
    if (!line) return;
    const top = line.offsetTop, bottom = top + line.offsetHeight;
    if (top < el.scrollTop + 8 || bottom > el.scrollTop + el.clientHeight - 8) el.scrollTo({ top: Math.max(0, top - el.clientHeight / 3), behavior: "smooth" });
  }, [t.stamp]);
  // Line numbers, in a gutter beside the code: as many as the rendered text has lines.
  const code = useRef<HTMLElement>(null);
  const [lines, setLines] = useState(1);
  useLayoutEffect(() => { setLines((code.current?.textContent ?? "").split("\n").length); });
  const r: R = { hover, stamp: t.stamp, live: t.stamp > 0, limit: compact ? 18 : 34 };
  return (
    <pre className="live-json" ref={pre} tabIndex={0} aria-label={label}
      onPointerOver={(e) => {
        const id = (e.target as Element).closest<HTMLElement>("[data-node]")?.dataset.node;
        if (id && id !== hover?.id) setHover({ id, from: "tree" });
      }}
      onPointerLeave={() => setHover(null)}>
      <span className="live-json-ln" aria-hidden>{Array.from({ length: lines }, (_, i) => i + 1).join("\n")}</span>
      <code ref={code}><Value v={v} prev={t.prev ?? v} depth={0} r={r} /></code>
    </pre>
  );
}
