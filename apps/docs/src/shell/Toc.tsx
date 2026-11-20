/**
 * "On this page": the page's h2 and h3, collected while the page is built (src/shell/render.tsx), so the list is in
 * the HTML and takes its room from the first paint. src/client/enhance.ts marks the section being read.
 */
import type { TocEntry } from "./collect";

export type { TocEntry };

function TocList({ entries }: { entries: TocEntry[] }) {
  return (
    <ul className="toc-list">
      {entries.map((e) => (
        <li key={e.id} data-level={e.level}>
          <a className="toc-link" href={`#${e.id}`}>
            {e.text}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function Toc({ entries }: { entries: TocEntry[] }) {
  if (!entries.length) return null;
  return (
    <nav className="toc" aria-labelledby="toc-heading">
      <h2 className="toc-heading" id="toc-heading">
        On this page
      </h2>
      <TocList entries={entries} />
    </nav>
  );
}

/** The same list, folded behind a button, for screens too narrow for the right column. */
export function TocDisclosure({ entries }: { entries: TocEntry[] }) {
  if (entries.length < 2) return null;
  return (
    <details className="toc-disclosure">
      <summary>On this page</summary>
      <TocList entries={entries} />
    </details>
  );
}
