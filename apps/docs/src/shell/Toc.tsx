/** "On this page": the rendered h2 and h3, with the section being read highlighted as the page scrolls. */
import { useEffect, useState } from "react";

export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Reads the headings from the page once it has rendered (`version` changes with each page). */
export function useHeadings(root: HTMLElement | null, version: string): TocEntry[] {
  const [entries, setEntries] = useState<TocEntry[]>([]);
  useEffect(() => {
    if (!root) return;
    const read = () =>
      setEntries(
        [...root.querySelectorAll<HTMLHeadingElement>("h2[id], h3[id]")]
          .filter((h) => !h.closest("[data-toc-skip], [data-jali], [data-live]"))
          .map((h) => ({
            id: h.id,
            text: h.textContent?.trim() ?? "",
            level: h.tagName === "H2" ? 2 : 3,
          })),
      );
    read();
    const mo = new MutationObserver(read);
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [root, version]);
  return entries;
}

/** The id of the last heading that has scrolled past the top of the reading area. */
export function useActiveHeading(entries: TocEntry[]): string | undefined {
  const [active, setActive] = useState<string>();
  useEffect(() => {
    if (!entries.length) {
      setActive(undefined);
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const offset = 120;
      let current = entries[0]!.id;
      for (const e of entries) {
        const el = document.getElementById(e.id);
        if (el && el.getBoundingClientRect().top - offset <= 0) current = e.id;
      }
      // At the very bottom, the last heading is the one being read.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4)
        current = entries.at(-1)!.id;
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [entries]);
  return active;
}

export function Toc({ entries, active }: { entries: TocEntry[]; active?: string }) {
  if (!entries.length) return null;
  return (
    <nav className="toc" aria-labelledby="toc-heading">
      <h2 className="toc-heading" id="toc-heading">
        On this page
      </h2>
      <ul className="toc-list">
        {entries.map((e) => (
          <li key={e.id} data-level={e.level}>
            <a
              className="toc-link"
              href={`#${e.id}`}
              aria-current={e.id === active ? "location" : undefined}
            >
              {e.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The same list, folded behind a button, for screens too narrow for the right column. */
export function TocDisclosure({ entries, active }: { entries: TocEntry[]; active?: string }) {
  if (entries.length < 2) return null;
  return (
    <details className="toc-disclosure">
      <summary>On this page</summary>
      <ul className="toc-list">
        {entries.map((e) => (
          <li key={e.id} data-level={e.level}>
            <a
              className="toc-link"
              href={`#${e.id}`}
              aria-current={e.id === active ? "location" : undefined}
              onClick={(ev) =>
                (ev.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute(
                  "open",
                )
              }
            >
              {e.text}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
