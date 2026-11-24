/**
 * "On this page": the page's h2 and h3, collected while the page is built (src/shell/render.tsx), so the list is in
 * the HTML and takes its room from the first paint. ./toc.client.ts marks the section being read.
 */
import type { TocEntry } from "./collect";

export type { TocEntry };

function TocList({ entries }: { entries: TocEntry[] }) {
  // An h3 before the page's first h2 (a page of steps) has no section to sit under: it shows at the top level.
  const firstH2 = entries.findIndex((e) => e.level === 2);
  const levelOf = (e: TocEntry, i: number) =>
    e.level === 3 && (firstH2 < 0 || i < firstH2) ? 2 : e.level;
  return (
    <ul className="toc-list">
      {entries.map((e, i) => (
        <li key={e.id} data-level={levelOf(e, i)}>
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

/**
 * The same list, folded behind a bar, for screens too narrow for the right column and for wide pages, which give that
 * column's room to the page. The bar stays under the top bar as the page scrolls and names the section being read
 * (./toc.client.ts fills `[data-toc-current]`), so a long page is never without its contents.
 */
export function TocDisclosure({ entries }: { entries: TocEntry[] }) {
  if (entries.length < 2) return null;
  return (
    <details className="toc-disclosure">
      <summary>
        <span className="toc-disclosure-label">On this page</span>
        <span className="toc-disclosure-current" data-toc-current="" />
      </summary>
      {/* Opens over the page, as a menu does: the page under it stays where it was. */}
      <div className="toc-disclosure-panel">
        <TocList entries={entries} />
      </div>
    </details>
  );
}
