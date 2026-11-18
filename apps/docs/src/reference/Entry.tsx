/**
 * Reference entries: one shape for every exported name (docs/DOCS-PLAN.md, "Reference entries"). The symbol is the
 * heading, then one line on what it does, the package it comes from, the options and what it returns. A signature and
 * a minimal example sit at the right when the entry is wide enough (Stripe's two columns), and under the line when not.
 *
 * The coverage test (coverage.test.ts) reads `name="…"` from <Entry> and <Member> in the MDX sources, so every
 * exported name needs one of the two.
 */
import { Children as ReactChildren, isValidElement, type ReactNode } from "react";
import { useMDXComponents } from "@mdx-js/react";
import "./reference.css";

export type EntryKind = "function" | "component" | "hook" | "type" | "constant" | "namespace" | "context" | "method";

const KIND_LABEL: Record<EntryKind, string> = {
  function: "Function", component: "Component", hook: "Hook", type: "Type", constant: "Constant",
  namespace: "Namespace", context: "Context", method: "Method",
};

/** The anchor for a name: `layout.open` stays `layout.open`, `<Jali>` is `Jali`. */
export const anchorOf = (name: string) => name.replace(/[<>/\s]/g, "");

type CodeProps = { code: string; lang?: string; filename?: string; highlight?: string };

/** The shell's <Code>, so samples look the same everywhere; a plain <pre> when no provider gives one. */
function useCode() {
  const components = useMDXComponents() as Record<string, unknown>;
  const Code = components.Code as ((p: CodeProps) => ReactNode) | undefined;
  return Code ?? (({ code }: CodeProps) => <pre><code>{code}</code></pre>);
}

export interface EntryProps {
  /** The exported name, exactly as imported (`createUiStore`, `layout.open`, `Jali`). */
  name: string;
  kind: EntryKind;
  /** "@jali/core" or "@jali/react". */
  from?: string;
  /** How it is called or what it is: shown at the top of the right column. */
  signature?: string;
  /** A minimal example (usually a sample imported with ?raw). */
  example?: string;
  exampleFile?: string;
  exampleHighlight?: string;
  /** Short entries (types, constants) skip the two columns. */
  compact?: boolean;
  /** Shown beside the kind: "Deprecated", "Internal state". */
  note?: string;
  children?: ReactNode;
}

export function Entry({ name, kind, from, signature, example, exampleFile, exampleHighlight, compact, note, children }: EntryProps) {
  const Code = useCode();
  const id = anchorOf(name);
  const shown = kind === "component" ? `<${name}>` : name;
  const aside = signature || example;
  // The first paragraph is the one line on what it does: it sits under the title, before the example.
  const [lead, ...rest] = ReactChildren.toArray(children);
  return (
    <section className="ref-entry" data-kind={kind} data-compact={compact || !aside ? "" : undefined} aria-labelledby={id}>
      <div className="ref-entry-grid">
      <header className="ref-entry-head">
        <h3 id={id} className="ref-entry-title">
          <a className="ref-anchor" href={`#${id}`}><code>{shown}</code></a>
        </h3>
        <p className="ref-entry-meta">
          <span className="ref-kind">{KIND_LABEL[kind]}</span>
          {from ? <span>From <code>{from}</code></span> : null}
          {note ? <span className="ref-note">{note}</span> : null}
        </p>
        {lead ? <div className="ref-entry-lead">{lead}</div> : null}
      </header>
      {aside ? (
        <div className="ref-entry-aside">
          {signature ? <pre className="ref-signature" aria-label="Signature"><code>{signature}</code></pre> : null}
          {example ? <Code code={example.trimEnd()} lang={exampleFile?.endsWith(".css") ? "css" : "tsx"} filename={exampleFile} highlight={exampleHighlight} /> : null}
        </div>
      ) : null}
      <div className="ref-entry-body">{rest}</div>
      </div>
    </section>
  );
}

/** A list of options, props, params or fields. */
export function Params({ title = "Parameters", children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="ref-params">
      <h4 className="ref-params-title">{title}</h4>
      <div className="ref-params-list">{children}</div>
    </div>
  );
}

export interface ParamProps {
  name: string;
  type: string;
  /** The default, as code ("8", `"local"`, "browserStorage(\"jali\")"); omit when there is none. */
  default?: string;
  required?: boolean;
  /** Read-only fields, deprecations. */
  flag?: string;
  children?: ReactNode;
}

/** One option: its name, type, whether it is required, its default, then one short paragraph. */
export function Param({ name, type, default: dflt, required, flag, children }: ParamProps) {
  const kids = ReactChildren.toArray(children);
  const nested = kids.filter((c) => isValidElement(c) && c.type === ChildParams);
  const text = kids.filter((c) => !(isValidElement(c) && c.type === ChildParams));
  return (
    <div className="ref-param">
      <div className="ref-param-head">
        <code className="ref-param-name">{name}</code>
        <code className="ref-param-type">{type}</code>
        <span className={required ? "ref-flag is-required" : "ref-flag"}>{required ? "Required" : "Optional"}</span>
        {flag ? <span className="ref-flag">{flag}</span> : null}
      </div>
      {dflt !== undefined ? <p className="ref-param-default">Default <code>{dflt}</code></p> : null}
      {text.length ? <div className="ref-param-body">{text}</div> : null}
      {nested}
    </div>
  );
}

/** Nested options (a field that is itself an object), behind a toggle as in Stripe's "Show child parameters". */
export function ChildParams({ label = "child parameters", children }: { label?: string; children?: ReactNode }) {
  return (
    <details className="ref-children">
      <summary>Show {label}</summary>
      <div className="ref-params-list">{children}</div>
    </details>
  );
}

/** What a function or hook returns. */
export function Returns({ type, children }: { type: string; children?: ReactNode }) {
  return (
    <div className="ref-returns">
      <h4 className="ref-params-title">Returns</h4>
      <p className="ref-returns-type"><code>{type}</code></p>
      {children ? <div className="ref-param-body">{children}</div> : null}
    </div>
  );
}

/** The values of a union, each with what it means (Stripe's "Possible enum values"). */
export function Values({ title = "Values", children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="ref-values">
      <p className="ref-values-title">{title}</p>
      <dl>{children}</dl>
    </div>
  );
}
export function Value({ name, children }: { name: string; children?: ReactNode }) {
  return (
    <div className="ref-value">
      <dt><code>{name}</code></dt>
      <dd>{children}</dd>
    </div>
  );
}

/** A table of small members (the helpers of `layout.tree`, the methods of `Actions`): one row each, with an anchor. */
export function Members({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="ref-members">
      {title ? <h4 className="ref-params-title">{title}</h4> : null}
      <dl className="ref-members-list">{children}</dl>
    </div>
  );
}
export function Member({ name, signature, children }: { name: string; signature?: string; children?: ReactNode }) {
  const id = anchorOf(name);
  const short = name.split(".").pop();
  return (
    <div className="ref-member" id={id}>
      <dt>
        <a className="ref-anchor" href={`#${id}`}><code className="ref-param-name">{short}</code></a>
        {signature ? <code className="ref-member-sig">{signature}</code> : null}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

/** An inline link to another entry: <Ref to="createUiStore" /> or <Ref to="UiState" page="/reference/core/types" />. */
export function Ref({ to, page, children }: { to: string; page?: string; children?: ReactNode }) {
  return <a className="ref-link" href={`${page ?? ""}#${anchorOf(to)}`}><code>{children ?? to}</code></a>;
}
