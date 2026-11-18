/** A page's header (section, title, summary, actions) and footer (previous and next, edit). */
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Copy, FileText, Pencil } from "lucide-react";
import { editUrl } from "../site/config";
import { markdownUrl, neighbours, sectionOf, sources, toMarkdown } from "../site/sources";
import { copyText } from "./mdx";

function PageActions({ path, title }: { path: string; title: string }) {
  const page = sources[path];
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);
  if (!page) return null;
  const md = markdownUrl(path);
  const abs = typeof window === "undefined" ? md : new URL(md, window.location.origin).href;
  const prompt = `Read the Jali docs page "${title}" at ${abs} and help me with it. Jali is a React library for workspaces of panes. Answer from that page and the rest of the Jali docs.`;
  return (
    <div className="page-actions" role="group" aria-label="Page actions">
      <button
        type="button"
        className="page-action"
        onClick={async () => setCopied(await copyText(toMarkdown(page)))}
      >
        {copied ? (
          <Check aria-hidden size={15} />
        ) : (
          <Copy aria-hidden size={15} strokeWidth={1.75} />
        )}
        <span aria-live="polite">{copied ? "Copied" : "Copy page"}</span>
      </button>
      <a className="page-action" href={md} target="_blank" rel="noreferrer">
        <FileText aria-hidden size={15} strokeWidth={1.75} />
        View as Markdown
      </a>
      <a
        className="page-action"
        href={`https://claude.ai/new?q=${encodeURIComponent(prompt)}`}
        target="_blank"
        rel="noreferrer"
      >
        <ArrowUpRight aria-hidden size={15} strokeWidth={1.75} />
        Open in Claude
      </a>
    </div>
  );
}

export function PageHeader({
  path,
  title,
  summary,
}: {
  path: string;
  title: string;
  summary: string;
}) {
  const section = sectionOf(path);
  return (
    <header className="page-header">
      {section ? <p className="page-eyebrow">{section}</p> : null}
      <h1 className="page-title">{title}</h1>
      {summary ? <p className="page-summary">{summary}</p> : null}
      <PageActions path={path} title={title} />
    </header>
  );
}

export function PageFooter({ path }: { path: string }) {
  const { prev, next } = neighbours(path);
  const file = sources[path]?.file;
  return (
    <footer className="page-footer">
      {prev || next ? (
        <nav className="pager" aria-label="Previous and next page">
          {prev ? (
            <a className="pager-link" data-dir="prev" href={prev.path}>
              <span className="pager-label">
                <ArrowLeft aria-hidden size={14} />
                Previous
              </span>
              <span className="pager-title">{prev.title}</span>
            </a>
          ) : (
            <span />
          )}
          {next ? (
            <a className="pager-link" data-dir="next" href={next.path}>
              <span className="pager-label">
                Next
                <ArrowRight aria-hidden size={14} />
              </span>
              <span className="pager-title">{next.title}</span>
            </a>
          ) : null}
        </nav>
      ) : null}
      <div className="page-meta">
        {file ? (
          <a href={editUrl(file)} target="_blank" rel="noreferrer">
            <Pencil aria-hidden size={13} strokeWidth={1.75} />
            Edit this page
          </a>
        ) : null}
      </div>
    </footer>
  );
}
