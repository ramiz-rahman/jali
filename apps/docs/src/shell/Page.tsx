/** A page's header (section, title, summary, actions) and footer (previous and next, edit, report). Static HTML. */
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  PencilSimpleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { editUrl, issueUrl } from "../site/config";
import { markdownUrl, neighbours, sectionOf, sources } from "../site/sources";

function PageActions({ path, title }: { path: string; title: string }) {
  if (!sources[path]) return null;
  const md = markdownUrl(path);
  // The site's public address, fixed at build time (astro.config.mjs `site`), so Claude gets an address it can fetch.
  const abs = new URL(md, import.meta.env.SITE).href;
  const prompt = `Read the Jali docs page "${title}" at ${abs} and help me with it. Jali is a React library for workspaces of panes. Answer from that page and the rest of the Jali docs.`;
  return (
    <div className="page-actions" role="group" aria-label="Page actions">
      {/* Copies the page's Markdown copy (src/client/enhance.ts). */}
      <button type="button" className="page-action" data-copy-page={md}>
        <CopyIcon aria-hidden size={15} className="icon-idle" />
        <CheckIcon aria-hidden size={15} className="icon-done" />
        <span aria-live="polite">Copy page</span>
      </button>
      <a className="page-action" href={md} target="_blank" rel="noreferrer">
        <FileTextIcon aria-hidden size={15} />
        View as Markdown
      </a>
      <a
        className="page-action"
        href={`https://claude.ai/new?q=${encodeURIComponent(prompt)}`}
        target="_blank"
        rel="noreferrer"
      >
        <ArrowUpRightIcon aria-hidden size={15} />
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
                <ArrowLeftIcon aria-hidden size={14} />
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
                <ArrowRightIcon aria-hidden size={14} />
              </span>
              <span className="pager-title">{next.title}</span>
            </a>
          ) : null}
        </nav>
      ) : null}
      <div className="page-meta">
        {file ? (
          <a href={editUrl(file)} target="_blank" rel="noreferrer">
            <PencilSimpleIcon aria-hidden size={13} />
            Edit this page
          </a>
        ) : null}
        {file ? (
          <a href={issueUrl(path, sources[path]!.title)} target="_blank" rel="noreferrer">
            <WarningCircleIcon aria-hidden size={13} />
            Report an issue
          </a>
        ) : null}
      </div>
    </footer>
  );
}
