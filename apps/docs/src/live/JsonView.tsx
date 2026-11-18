/**
 * The layout as JSON, the way it is stored and linked: pretty, highlighted, and with each node's object marked so that
 * hovering it lights its pane, as the tree does.
 */
import type { ReactNode } from "react";
import type { Hover } from "./LayoutTree";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const isObj = (v: Json): v is { [k: string]: Json } => !!v && typeof v === "object" && !Array.isArray(v);
const isNode = (v: Json): v is { [k: string]: Json } => isObj(v) && typeof v.id === "string" && typeof v.type === "string";
/** Small leaves (a size, a ref) stay on one line. */
const inline = (v: Json) => !isNode(v) && JSON.stringify(v).length <= 44 && !JSON.stringify(v).includes('"type"');

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

function Value({ v, depth, hover }: { v: Json; depth: number; hover: Hover | null }): ReactNode {
  if (inline(v) || (typeof v !== "object" || v === null)) return <Inline v={v} />;
  const pad = "  ".repeat(depth + 1), end = "  ".repeat(depth);
  if (Array.isArray(v)) {
    return <>[{"\n"}{v.map((x, i) => <span key={i}>{pad}<Value v={x} depth={depth + 1} hover={hover} />{i < v.length - 1 ? "," : ""}{"\n"}</span>)}{end}]</>;
  }
  const ks = Object.keys(v);
  const body = <>{"{"}{"\n"}{ks.map((k, i) => (
    <span key={k}>{pad}<span className="j-key">"{k}"</span>: <Value v={v[k]!} depth={depth + 1} hover={hover} />{i < ks.length - 1 ? "," : ""}{"\n"}</span>
  ))}{end}{"}"}</>;
  if (!isNode(v)) return body;
  const id = v.id as string;
  return <span className="j-node" data-node={id} data-lit={hover?.id === id || undefined}>{body}</span>;
}

export function JsonView({ value, hover, setHover, label }: { value: unknown; hover: Hover | null; setHover(h: Hover | null): void; label: string }) {
  const v = JSON.parse(JSON.stringify(value)) as Json;
  return (
    <pre className="live-json" tabIndex={0} aria-label={label}
      onPointerOver={(e) => {
        const id = (e.target as Element).closest<HTMLElement>("[data-node]")?.dataset.node;
        if (id && id !== hover?.id) setHover({ id, from: "tree" });
      }}
      onPointerLeave={() => setHover(null)}>
      <code><Value v={v} depth={0} hover={hover} /></code>
    </pre>
  );
}
