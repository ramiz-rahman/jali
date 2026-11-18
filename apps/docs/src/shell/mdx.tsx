/**
 * Components MDX pages use without importing them. The names and props are the contract with every page
 * (apps/docs/AGENTS.md); the shell agent owns the implementations and may restyle freely, never rename.
 */
import type { ReactNode } from "react";
import type { MDXComponents } from "mdx/types";

/** A code sample: `code` is the text (often `import x from "./sample.tsx?raw"`), `highlight` is "3-5,9". */
export function Code({ code, lang = "tsx", filename, highlight }: { code: string; lang?: string; filename?: string; highlight?: string }) {
  return <figure data-code="" data-lang={lang} data-highlight={highlight}>{filename ? <figcaption>{filename}</figcaption> : null}<pre><code>{code}</code></pre></figure>;
}
/** A note beside the text. `type`: note (default), tip, warning. */
export function Callout({ type = "note", title, children }: { type?: "note" | "tip" | "warning"; title?: string; children?: ReactNode }) {
  return <aside data-callout={type}>{title ? <strong>{title}</strong> : null}{children}</aside>;
}
/** A numbered path: <Steps><Step title="Install">…</Step></Steps>. */
export function Steps({ children }: { children?: ReactNode }) { return <ol data-steps="">{children}</ol>; }
export function Step({ title, children }: { title: string; children?: ReactNode }) { return <li><h3>{title}</h3>{children}</li>; }
/** Tabs. `group` remembers the choice across the site ("pm" for package managers, "framework"). */
export function Tabs({ group, children }: { group?: string; children?: ReactNode }) { return <div data-tabs={group ?? ""}>{children}</div>; }
export function Tab({ label, children }: { label: string; children?: ReactNode }) { return <section data-tab={label}><h4>{label}</h4>{children}</section>; }
/** Install commands for npm, pnpm, yarn and bun, in a remembered "pm" tab group. */
export function Install({ packages }: { packages: string }) { return <pre data-install=""><code>npm install {packages}</code></pre>; }
/** A grid of links to other pages. */
export function Cards({ children }: { children?: ReactNode }) { return <div data-cards="">{children}</div>; }
export function Card({ title, href, children }: { title: string; href: string; children?: ReactNode }) { return <a data-card="" href={href}><strong>{title}</strong>{children}</a>; }

export const mdxComponents: MDXComponents = { Code, Callout, Steps, Step, Tabs, Tab, Install, Cards, Card };
