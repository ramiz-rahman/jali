/**
 * Components MDX pages use without importing them. The names and props are the contract with every page
 * (apps/docs/AGENTS.md); the shell agent owns the implementations and may restyle freely, never rename.
 */
import { Children, isValidElement, useEffect, useId, useRef, useState, useSyncExternalStore, type ComponentPropsWithoutRef, type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import { flushSync } from "react-dom";
import type { MDXComponents } from "mdx/types";
import type { ThemedToken } from "shiki/core";
import { ArrowRight, Check, Copy, File, Info, Lightbulb, Link as LinkIcon, TriangleExclamationPoint, WrapText } from "lucide-react";
import { langOf, parseRanges, tokenize } from "./highlight";
import { readStored, writeStored } from "../site/storage";

// ---------- text helpers ----------

/** The plain text inside a React tree (a fenced block's lines, a heading's words). */
export function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

export const slugify = (text: string) =>
  text.toLowerCase().replace(/[`'"’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// ---------- copy ----------

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function CopyButton({ text, label = "Copy code" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button type="button" className="code-tool code-copy" aria-label={copied ? "Copied" : label} title={copied ? "Copied" : label}
      data-copied={copied || undefined} onClick={async () => setCopied(await copyText(text))}>
      {copied ? <Check aria-hidden size={15} strokeWidth={2} /> : <Copy aria-hidden size={15} strokeWidth={1.75} />}
      <span className="visually-hidden" aria-live="polite">{copied ? "Copied" : ""}</span>
    </button>
  );
}

// ---------- wrap ----------

/** Wrapping long lines is one choice for the whole site: remembered, and shared by every block on the page. */
const WRAP_KEY = "jali-docs-code-wrap";
const wrapListeners = new Set<() => void>();
let wrapValue: boolean | null = null;

const readWrap = () => (wrapValue ??= readStored(WRAP_KEY) === "1");
function setWrap(on: boolean) {
  wrapValue = on;
  writeStored(WRAP_KEY, on ? "1" : "0");
  for (const l of wrapListeners) l();
}
function subscribeWrap(l: () => void) {
  wrapListeners.add(l);
  // Another tab changed it: follow along.
  const onStorage = (e: StorageEvent) => { if (e.key === WRAP_KEY) { wrapValue = e.newValue === "1"; l(); } };
  window.addEventListener("storage", onStorage);
  return () => { wrapListeners.delete(l); window.removeEventListener("storage", onStorage); };
}
const useWrap = () => useSyncExternalStore(subscribeWrap, readWrap, () => false);

function WrapButton() {
  const wrap = useWrap();
  return (
    <button type="button" className="code-tool code-wrap" aria-label="Wrap lines" title="Wrap lines" aria-pressed={wrap}
      onClick={(e) => {
        // Blocks above change height; keep the button where the reader's pointer is.
        const el = e.currentTarget, top = el.getBoundingClientRect().top;
        flushSync(() => setWrap(!wrap));
        const moved = el.getBoundingClientRect().top - top;
        if (Math.abs(moved) > 1) window.scrollBy({ top: moved, behavior: "instant" });
      }}>
      <WrapText aria-hidden size={15} strokeWidth={1.75} />
    </button>
  );
}

// ---------- code ----------

function useTokens(code: string, lang: string) {
  const [tokens, setTokens] = useState<ThemedToken[][] | null>(null);
  useEffect(() => {
    let live = true;
    tokenize(code, lang).then((t) => { if (live) setTokens(t); }, () => {});
    return () => { live = false; };
  }, [code, lang]);
  return tokens;
}

const fontStyleOf = (t: ThemedToken) => {
  const f = t.fontStyle ?? 0;
  return f > 0 ? { fontStyle: f & 1 ? "italic" : undefined, fontWeight: f & 2 ? 600 : undefined } : undefined;
};

/** The columns a line's leading whitespace takes (a tab is two, as tab-size is): a wrapped line hangs below it. */
function indentOf(line: ThemedToken[]): number {
  const lead = /^[ \t]*/.exec(line.map((t) => t.content).join(""))?.[0] ?? "";
  let n = 0;
  for (const c of lead) n += c === "\t" ? 2 : 1;
  return n;
}

const trimCode = (code: string) => code.replace(/\n+$/, "");
/** A one-line shell command reads as a command, not a listing: it has no line number. */
const isOneLineShell = (code: string, lang: string) => langOf(lang) === "sh" && !trimCode(code).includes("\n");

function CodeBody({ code, lang, highlight, numbers }: { code: string; lang: string; highlight?: string; numbers: boolean }) {
  const text = trimCode(code);
  const tokens = useTokens(text, lang);
  const lit = parseRanges(highlight);
  const lines = tokens ?? text.split("\n").map((l) => [{ content: l, offset: 0 } as ThemedToken]);
  const digits = String(lines.length).length;
  return (
    <pre className="code-pre" tabIndex={0} data-lang={lang} data-lit={lit.size ? "" : undefined} data-numbers={numbers ? "" : undefined}
      style={numbers ? ({ "--code-digits": `${digits}ch` } as CSSProperties) : undefined}>
      <code>
        {lines.map((line, i) => {
          const indent = indentOf(line);
          return (
            <span key={i} className="code-line" data-n={numbers ? i + 1 : undefined} data-lit={lit.has(i + 1) || undefined}
              style={indent ? ({ "--code-indent": `${indent}ch` } as CSSProperties) : undefined}>
              <span className="code-text">
                {line.length && line.some((t) => t.content) ? line.map((t, j) => <span key={j} style={{ color: tokens ? t.color : undefined, ...fontStyleOf(t) }}>{t.content}</span>) : "\u200b"}
              </span>
            </span>
          );
        })}
      </code>
    </pre>
  );
}

/**
 * A code sample: `code` is the text (often `import x from "./sample.tsx?raw"`), `highlight` is "3-5,9".
 * `numbers` shows line numbers; on by default, off by default for a one-line shell command.
 */
export function Code({ code, lang = "tsx", filename, highlight, numbers }: { code: string; lang?: string; filename?: string; highlight?: string; numbers?: boolean }) {
  const wrap = useWrap();
  const tools = <><WrapButton /><CopyButton text={code} /></>;
  return (
    <figure className="code" data-code="" data-lang={lang} data-has-header={filename ? "" : undefined} data-wrap={wrap || undefined}>
      {filename ? (
        <figcaption className="code-header">
          <span className="code-filename"><File aria-hidden size={14} strokeWidth={1.75} />{filename}</span>
          <span className="code-tools">{tools}</span>
        </figcaption>
      ) : <div className="code-tools code-tools-float">{tools}</div>}
      <CodeBody code={code} lang={lang} highlight={highlight} numbers={numbers ?? !isOneLineShell(code, lang)} />
    </figure>
  );
}

/** Fenced code blocks: the text and language come from the Markdown; the block looks exactly like <Code>. */
function Pre(props: ComponentPropsWithoutRef<"pre"> & Record<string, unknown>) {
  const child = Children.toArray(props.children)[0];
  const className = isValidElement<{ className?: string }>(child) ? child.props.className ?? "" : "";
  const lang = /language-([\w-]+)/.exec(className)?.[1] ?? (typeof props["data-language"] === "string" ? props["data-language"] : "text");
  const filename = (props["data-filename"] ?? props.filename ?? props.title) as string | undefined;
  const highlight = (props["data-highlight"] ?? props.highlight) as string | undefined;
  return <Code code={textOf(props.children)} lang={lang} filename={filename} highlight={highlight} />;
}

function InlineCode(props: ComponentPropsWithoutRef<"code">) {
  return <code className="inline-code" {...props} />;
}

// ---------- headings ----------

function heading(level: 2 | 3 | 4) {
  const Tag = `h${level}` as const;
  return function Heading({ id, children, ...rest }: ComponentPropsWithoutRef<"h2">) {
    const slug = id ?? slugify(textOf(children));
    return (
      <Tag id={slug} className="heading" {...rest}>
        <a className="heading-anchor" href={`#${slug}`} aria-label={`Link to this section: ${textOf(children)}`}>
          <LinkIcon aria-hidden size={14} strokeWidth={2} />
        </a>
        {children}
      </Tag>
    );
  };
}

// ---------- callout ----------

const CALLOUT_ICON = { note: Info, tip: Lightbulb, warning: TriangleExclamationPoint };
const CALLOUT_LABEL = { note: "Note", tip: "Tip", warning: "Warning" };

/** A note beside the text. `type`: note (default), tip, warning. */
export function Callout({ type = "note", title, children }: { type?: "note" | "tip" | "warning"; title?: string; children?: ReactNode }) {
  const Icon = CALLOUT_ICON[type] ?? Info;
  return (
    <aside className="callout" data-callout={type} aria-label={title ? undefined : CALLOUT_LABEL[type]}>
      <Icon aria-hidden className="callout-icon" size={17} strokeWidth={1.75} />
      <div className="callout-body">
        {title ? <p className="callout-title">{title}</p> : null}
        {children}
      </div>
    </aside>
  );
}

// ---------- steps ----------

/** A numbered path: <Steps><Step title="Install">…</Step></Steps>. */
export function Steps({ children }: { children?: ReactNode }) {
  return <ol className="steps" data-steps="">{children}</ol>;
}
const StepHeading = heading(3);
export function Step({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <li className="step">
      <StepHeading className="heading step-title">{title}</StepHeading>
      <div className="step-body">{children}</div>
    </li>
  );
}

// ---------- tabs ----------

const groupListeners = new Set<() => void>();
const groupValues = new Map<string, string>();
const groupKey = (g: string) => `jali-docs-tab:${g}`;

function readGroup(group: string): string | null {
  if (!groupValues.has(group)) {
    const stored = typeof window === "undefined" ? null : readStored(groupKey(group));
    if (stored) groupValues.set(group, stored);
  }
  return groupValues.get(group) ?? null;
}
function writeGroup(group: string, value: string) {
  groupValues.set(group, value);
  writeStored(groupKey(group), value);
  for (const l of groupListeners) l();
}

/** The chosen label, remembered across the site for a `group`, local to the block without one. */
function useTabChoice(group: string | undefined, labels: string[]) {
  const [local, setLocal] = useState<string | null>(null);
  const remembered = useSyncExternalStore(
    (l) => { groupListeners.add(l); return () => groupListeners.delete(l); },
    () => (group ? readGroup(group) : null),
    () => null,
  );
  const chosen = (group ? remembered : local) ?? local;
  const value = chosen && labels.includes(chosen) ? chosen : labels[0] ?? "";
  const choose = (v: string) => { setLocal(v); if (group) writeGroup(group, v); };
  return [value, choose] as const;
}

function TabStrip({ labels, value, onChoose, idBase, label }: { labels: string[]; value: string; onChoose: (v: string) => void; idBase: string; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = labels.length;
    const to = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    onChoose(labels[to]!);
    refs.current[to]?.focus();
  };
  return (
    <div className="tab-strip" role="tablist" aria-label={label}>
      {labels.map((l, i) => (
        <button key={l} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" id={`${idBase}-tab-${i}`}
          aria-selected={l === value} aria-controls={`${idBase}-panel-${i}`} tabIndex={l === value ? 0 : -1}
          className="tab" onClick={() => onChoose(l)} onKeyDown={(e) => onKey(e, i)}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** Tabs. `group` remembers the choice across the site ("pm" for package managers, "framework"). */
export function Tabs({ group, children }: { group?: string; children?: ReactNode }) {
  const tabs = Children.toArray(children).filter((c): c is ReactElement<{ label: string; children?: ReactNode }> =>
    isValidElement<{ label?: string }>(c) && typeof c.props.label === "string");
  const labels = tabs.map((t) => t.props.label);
  const [value, choose] = useTabChoice(group, labels);
  const idBase = useId().replace(/:/g, "");
  return (
    <div className="tabs" data-tabs={group ?? ""}>
      <TabStrip labels={labels} value={value} onChoose={choose} idBase={idBase} label={group === "pm" ? "Package manager" : "Choose one"} />
      {tabs.map((t, i) => (
        <div key={t.props.label} role="tabpanel" id={`${idBase}-panel-${i}`} aria-labelledby={`${idBase}-tab-${i}`}
          hidden={t.props.label !== value} className="tab-panel">
          {t.props.children}
        </div>
      ))}
    </div>
  );
}
export function Tab({ children }: { label: string; children?: ReactNode }) {
  return <>{children}</>;
}

// ---------- install ----------

const MANAGERS = [
  { label: "npm", cmd: "npm install" },
  { label: "pnpm", cmd: "pnpm add" },
  { label: "yarn", cmd: "yarn add" },
  { label: "bun", cmd: "bun add" },
];

/** Install commands for npm, pnpm, yarn and bun, in a remembered "pm" tab group. */
export function Install({ packages }: { packages: string }) {
  const labels = MANAGERS.map((m) => m.label);
  const [value, choose] = useTabChoice("pm", labels);
  const idBase = useId().replace(/:/g, "");
  const i = Math.max(0, labels.indexOf(value));
  const command = `${MANAGERS[i]!.cmd} ${packages}`;
  const wrap = useWrap();
  return (
    <figure className="code install" data-install="" data-has-header="" data-wrap={wrap || undefined}>
      <div className="code-header">
        <TabStrip labels={labels} value={value} onChoose={choose} idBase={idBase} label="Package manager" />
        <CopyButton text={command} label="Copy command" />
      </div>
      <div role="tabpanel" id={`${idBase}-panel-${i}`} aria-labelledby={`${idBase}-tab-${i}`}>
        <CodeBody code={command} lang="sh" numbers={false} />
      </div>
    </figure>
  );
}

// ---------- cards ----------

/** A grid of links to other pages. */
export function Cards({ children }: { children?: ReactNode }) {
  return <div className="cards" data-cards="">{children}</div>;
}
export function Card({ title, href, children }: { title: string; href: string; children?: ReactNode }) {
  return (
    <a className="card" data-card="" href={href}>
      <span className="card-title">{title}<ArrowRight aria-hidden className="card-arrow" size={16} strokeWidth={1.75} /></span>
      {children ? <span className="card-text">{children}</span> : null}
    </a>
  );
}

// ---------- prose elements ----------

function Table(props: ComponentPropsWithoutRef<"table">) {
  return <div className="table-wrap" tabIndex={0} role="region" aria-label="Table"><table {...props} /></div>;
}

function Anchor({ href = "", ...rest }: ComponentPropsWithoutRef<"a">) {
  const external = /^https?:\/\//.test(href);
  return <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})} {...rest} />;
}

export const mdxComponents: MDXComponents = {
  Code, Callout, Steps, Step, Tabs, Tab, Install, Cards, Card,
  h2: heading(2), h3: heading(3), h4: heading(4),
  pre: Pre as MDXComponents["pre"], code: InlineCode, table: Table, a: Anchor,
};
