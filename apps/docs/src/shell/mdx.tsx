/**
 * Components MDX pages use without importing them. The names and props are the contract with every page
 * (apps/docs/AGENTS.md); the shell agent owns the implementations and may restyle freely, never rename.
 *
 * They render static HTML at build time, code already highlighted. What they do in the browser (copy, wrap lines,
 * switch tabs) is src/client/enhance.ts, which finds them by their data attributes.
 */
import {
  Children,
  isValidElement,
  useContext,
  useId,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import type { MDXComponents } from "mdx/types";
import type { ThemedToken } from "shiki/core";
import {
  ArrowRightIcon,
  CaretDownIcon,
  CheckIcon,
  CopyIcon,
  FileIcon,
  InfoIcon,
  LightbulbIcon,
  LinkIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { langOf, parseRanges, tokenize } from "./highlight";
import { Collect } from "./collect";
import { MediaImage } from "./media";
import { PackageManagerMark } from "./pm-marks";

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
  text
    .toLowerCase()
    .replace(/[`'"’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** An id from React's `useId` that is a plain word, for `id` and `aria-controls`. */
const usePlainId = () => useId().replace(/[^\w-]/g, "");

// ---------- tools ----------

function CopyButton({ label = "Copy code" }: { label?: string }) {
  return (
    <button
      type="button"
      className="code-tool code-copy"
      aria-label={label}
      title={label}
      data-copy-code=""
    >
      <CopyIcon aria-hidden size={15} className="icon-idle" />
      <CheckIcon aria-hidden size={15} className="icon-done" />
      <span className="visually-hidden" aria-live="polite"></span>
    </button>
  );
}

/**
 * Wrap lines: the editors' glyph (a line that runs on, hooks round and returns under itself, then a short line).
 * Phosphor has none, so it is drawn on Phosphor's 256 grid with its regular stroke (16, round caps).
 */
function WrapIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      stroke="currentColor"
      strokeWidth={16}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M40 64H216M40 128H180a32 32 0 0 1 0 64H140M164 168l-24 24 24 24M40 192H96" />
    </svg>
  );
}

/** Wrapping long lines is one choice for the whole site: `data-code-wrap` on <html>, remembered. */
function WrapButton() {
  return (
    <button
      type="button"
      className="code-tool code-wrap"
      aria-label="Wrap lines"
      title="Wrap lines"
      aria-pressed={false}
      data-wrap-toggle=""
    >
      <WrapIcon size={15} />
    </button>
  );
}

// ---------- code ----------

const fontStyleOf = (t: ThemedToken): CSSProperties | undefined => {
  const f = t.fontStyle ?? 0;
  return f > 0
    ? { fontStyle: f & 1 ? "italic" : undefined, fontWeight: f & 2 ? 600 : undefined }
    : undefined;
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
const isOneLineShell = (code: string, lang: string) =>
  langOf(lang) === "sh" && !trimCode(code).includes("\n");

export function CodeBody({
  code,
  lang,
  highlight,
  numbers,
}: {
  code: string;
  lang: string;
  highlight?: string;
  numbers: boolean;
}) {
  const text = trimCode(code);
  const tokens = tokenize(text, lang);
  const lit = parseRanges(highlight);
  const lines = tokens ?? text.split("\n").map((l) => [{ content: l, offset: 0 } as ThemedToken]);
  const digits = String(lines.length).length;
  return (
    <pre
      className="code-pre"
      tabIndex={0}
      data-lang={lang}
      data-lit={lit.size ? "" : undefined}
      data-numbers={numbers ? "" : undefined}
      style={numbers ? ({ "--code-digits": `${digits}ch` } as CSSProperties) : undefined}
    >
      <code>
        {lines.map((line, i) => {
          const indent = indentOf(line);
          return (
            <span
              key={i}
              className="code-line"
              data-n={numbers ? i + 1 : undefined}
              data-lit={lit.has(i + 1) || undefined}
              style={indent ? ({ "--code-indent": `${indent}ch` } as CSSProperties) : undefined}
            >
              <span className="code-text">
                {line.length && line.some((t) => t.content)
                  ? line.map((t, j) => (
                      <span
                        key={j}
                        style={{ color: tokens ? t.color : undefined, ...fontStyleOf(t) }}
                      >
                        {t.content}
                      </span>
                    ))
                  : "​"}
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
export function Code({
  code,
  lang = "tsx",
  filename,
  highlight,
  numbers,
}: {
  code: string;
  lang?: string;
  filename?: string;
  highlight?: string;
  numbers?: boolean;
}) {
  const tools = (
    <>
      <WrapButton />
      <CopyButton />
    </>
  );
  return (
    <figure
      className="code"
      data-code=""
      data-lang={lang}
      data-has-header={filename ? "" : undefined}
    >
      {filename ? (
        <figcaption className="code-header">
          <span className="code-filename">
            <FileIcon aria-hidden size={14} />
            {filename}
          </span>
          <span className="code-tools">{tools}</span>
        </figcaption>
      ) : (
        <div className="code-tools code-tools-float">{tools}</div>
      )}
      <CodeBody
        code={code}
        lang={lang}
        highlight={highlight}
        numbers={numbers ?? !isOneLineShell(code, lang)}
      />
    </figure>
  );
}

/** Fenced code blocks: the text and language come from the Markdown; the block looks exactly like <Code>. */
function Pre(props: ComponentPropsWithoutRef<"pre"> & Record<string, unknown>) {
  const child = Children.toArray(props.children)[0];
  const className = isValidElement<{ className?: string }>(child)
    ? (child.props.className ?? "")
    : "";
  const lang = /language-([\w-]+)/.exec(className)?.[1] ?? "text";
  const filename = props["data-filename"] as string | undefined;
  const highlight = props["data-highlight"] as string | undefined;
  return (
    <Code code={textOf(props.children)} lang={lang} filename={filename} highlight={highlight} />
  );
}

/** Inline code. A short token with no spaces (`[data-theme="dark"]`) never breaks inside itself, at a hyphen or not. */
function InlineCode(props: ComponentPropsWithoutRef<"code">) {
  const text = typeof props.children === "string" ? props.children : "";
  const whole = text.length > 0 && text.length <= 32 && !/\s/.test(text);
  return <code className="inline-code" data-whole={whole || undefined} {...props} />;
}

// ---------- headings ----------

/**
 * A heading with an id, and a link to it beside it: the link comes after the heading, outside it, so the heading is
 * read as its words alone, and the link is in the Tab order with its own name ("Link to this section: …"), for every
 * level, h4s included (which "On this page" leaves out). It shows in the margin on hover and on focus
 * (docs/DECISIONS.md, 21 Nov 2026). h2 and h3 are collected for the TOC and search while the page is built.
 */
function heading(level: 2 | 3 | 4) {
  const Tag = `h${level}` as const;
  return function Heading({ id, children, ...rest }: ComponentPropsWithoutRef<"h2">) {
    const text = textOf(children).trim();
    const slug = id ?? slugify(text);
    const collect = useContext(Collect);
    if (collect && level !== 4) collect.headings.push({ id: slug, text, level });
    return (
      <div className="heading-wrap" data-level={level}>
        <Tag id={slug} className="heading" {...rest}>
          {children}
        </Tag>
        <a className="heading-anchor" href={`#${slug}`}>
          <LinkIcon aria-hidden size={14} />
          <span className="visually-hidden">Link to this section: {text}</span>
        </a>
      </div>
    );
  };
}

// ---------- callout ----------

const CALLOUT_ICON = { note: InfoIcon, tip: LightbulbIcon, warning: WarningIcon };
const CALLOUT_LABEL = { note: "Note", tip: "Tip", warning: "Warning" };

/** A note beside the text. `type`: note (default), tip, warning. */
export function Callout({
  type = "note",
  title,
  children,
}: {
  type?: "note" | "tip" | "warning";
  title?: string;
  children?: ReactNode;
}) {
  const Icon = CALLOUT_ICON[type] ?? InfoIcon;
  return (
    <aside
      className="callout"
      data-callout={type}
      aria-label={title ? undefined : CALLOUT_LABEL[type]}
    >
      <Icon aria-hidden className="callout-icon" size={17} />
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
  return (
    <ol className="steps" data-steps="">
      {children}
    </ol>
  );
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

/**
 * A tab strip and one panel per tab, the first shown. In the browser, enhance.ts switches them (click, arrows, Home,
 * End) and, for a `group`, remembers the choice across the site.
 */
export function TabSet({
  label,
  tabs,
  panelClass,
  render,
}: {
  label: string;
  tabs: { label: string; panel: ReactNode }[];
  panelClass?: string;
  /** Lays out the strip and the panels; the element holding both carries `data-tabs`. */
  render: (strip: ReactNode, panels: ReactNode) => ReactNode;
}) {
  const idBase = usePlainId();
  const strip = (
    <div className="tab-strip" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.label}
          type="button"
          role="tab"
          id={`${idBase}-tab-${i}`}
          aria-selected={i === 0}
          aria-controls={`${idBase}-panel-${i}`}
          tabIndex={i === 0 ? 0 : -1}
          className="tab"
          data-tab-label={t.label}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
  const panels = tabs.map((t, i) => (
    <div
      key={t.label}
      role="tabpanel"
      id={`${idBase}-panel-${i}`}
      aria-labelledby={`${idBase}-tab-${i}`}
      hidden={i !== 0}
      className={panelClass}
    >
      {t.panel}
    </div>
  ));
  return render(strip, panels);
}

/** Tabs. `group` remembers the choice across the site ("pm" for package managers, "framework"). */
export function Tabs({ group, children }: { group?: string; children?: ReactNode }) {
  const tabs = Children.toArray(children)
    .filter(
      (c): c is ReactElement<{ label: string; children?: ReactNode }> =>
        isValidElement<{ label?: string }>(c) && typeof c.props.label === "string",
    )
    .map((t) => ({ label: t.props.label, panel: t.props.children }));
  return (
    <TabSet
      label={group === "pm" ? "Package manager" : "Choose one"}
      tabs={tabs}
      panelClass="tab-panel"
      render={(strip, panels) => (
        <div className="tabs" data-tabs={group ?? ""}>
          {strip}
          {panels}
        </div>
      )}
    />
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
  { label: "vp", cmd: "vp install" },
];

/**
 * The install command on one line: the package manager (its mark and name, a button that opens a menu of all five), the
 * command for it, and Copy. Every command is in the HTML and the menu shows one; enhance.ts opens the menu, moves
 * through it from the keyboard, and keeps the choice as the remembered "pm" group, so every install line follows it.
 */
export function Install({ packages }: { packages: string }) {
  const id = usePlainId();
  const first = MANAGERS[0]!.label;
  return (
    <figure className="code install" data-install="" data-tabs="pm">
      <div className="install-pm" data-pm="">
        <button
          type="button"
          className="install-trigger"
          id={`${id}-pm`}
          aria-haspopup="listbox"
          aria-expanded="false"
          aria-controls={`${id}-pm-list`}
          aria-label={`Package manager: ${first}`}
          data-pm-trigger=""
        >
          {MANAGERS.map((m) => (
            <span
              key={m.label}
              className="install-current"
              data-pm-current={m.label}
              hidden={m.label !== first}
            >
              <PackageManagerMark name={m.label} />
              {m.label}
            </span>
          ))}
          <CaretDownIcon aria-hidden size={11} weight="bold" className="install-caret" />
        </button>
        <ul
          className="install-menu"
          id={`${id}-pm-list`}
          role="listbox"
          aria-label="Package manager"
          tabIndex={-1}
          hidden
          data-pm-menu=""
        >
          {MANAGERS.map((m) => (
            <li
              key={m.label}
              id={`${id}-pm-${m.label}`}
              className="install-option"
              role="option"
              aria-selected={m.label === first}
              data-pm-option={m.label}
            >
              <PackageManagerMark name={m.label} />
              <span className="install-option-name">{m.label}</span>
              <CheckIcon aria-hidden size={13} weight="bold" className="install-check" />
            </li>
          ))}
        </ul>
      </div>
      {MANAGERS.map((m) => (
        <div
          key={m.label}
          className="install-command"
          data-pm-panel={m.label}
          hidden={m.label !== first}
        >
          <CodeBody code={`${m.cmd} ${packages}`} lang="sh" numbers={false} />
        </div>
      ))}
      <CopyButton label="Copy command" />
    </figure>
  );
}

// ---------- cards ----------

/** A grid of links to other pages. */
export function Cards({ children }: { children?: ReactNode }) {
  return (
    <div className="cards" data-cards="">
      {children}
    </div>
  );
}
export function Card({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children?: ReactNode;
}) {
  return (
    <a className="card" data-card="" href={href}>
      <span className="card-title">
        {title}
        <ArrowRightIcon aria-hidden className="card-arrow" size={16} />
      </span>
      {children ? <span className="card-text">{children}</span> : null}
    </a>
  );
}

// ---------- prose elements ----------

/** The text of a table's header cells, "Token, Light, Dark": what tells one table's region from another's. */
function headerText(children: ReactNode): string {
  const cells: string[] = [];
  const walk = (node: ReactNode, inHead: boolean) =>
    Children.forEach(node, (c) => {
      if (!isValidElement<{ children?: ReactNode }>(c)) return;
      if (inHead && c.type === "th") cells.push(textOf(c.props.children).trim());
      else walk(c.props.children, inHead || c.type === "thead");
    });
  walk(children, false);
  return cells.filter(Boolean).join(", ");
}

/** A table that scrolls sideways when it is wide: a named region, reachable from the keyboard. */
function Table(props: ComponentPropsWithoutRef<"table">) {
  const head = headerText(props.children);
  return (
    <div
      className="table-wrap"
      tabIndex={0}
      role="region"
      aria-label={head ? `Table: ${head}` : "Table"}
    >
      <table {...props} />
    </div>
  );
}

function Anchor({ href = "", ...rest }: ComponentPropsWithoutRef<"a">) {
  const external = /^https?:\/\//.test(href);
  return <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})} {...rest} />;
}

export const mdxComponents: MDXComponents = {
  Code,
  Callout,
  Steps,
  Step,
  Tabs,
  Tab,
  Install,
  Cards,
  Card,
  h2: heading(2),
  h3: heading(3),
  h4: heading(4),
  pre: Pre as MDXComponents["pre"],
  code: InlineCode,
  table: Table,
  a: Anchor,
  img: MediaImage as MDXComponents["img"],
};
