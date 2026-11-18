/**
 * Search over page titles, summaries and headings, in a modal dialog. ⌘K, Ctrl+K or "/" opens it. A stand-in until
 * Pagefind searches the built pages (docs/DOCS-PLAN.md).
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CornerDownLeft, FileText, Hash, Search as SearchIcon } from "lucide-react";
import { navigate } from "../site/router";
import { publicPages, readingOrder, sectionOf } from "../site/sources";
import { slugify } from "./mdx";

interface Hit { key: string; path: string; href: string; title: string; detail: string; section?: string; heading?: boolean }

function search(q: string): Hit[] {
  const pages = publicPages();
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) {
    return readingOrder().slice(0, 8).map((i) => {
      const p = pages.find((x) => x.path === i.path);
      return { key: i.path, path: i.path, href: i.path, title: i.title, detail: p?.summary ?? "", section: i.section };
    });
  }
  const hits: (Hit & { score: number })[] = [];
  const score = (text: string, w: number) => {
    const t = text.toLowerCase();
    if (!terms.every((x) => t.includes(x))) return 0;
    return w * (t.startsWith(terms[0]!) ? 2 : 1);
  };
  for (const p of pages) {
    const s = score(p.title, 6) + score(p.summary, 2) + score(`${p.title} ${p.summary}`, 1);
    if (s) hits.push({ key: p.path, path: p.path, href: p.path, title: p.title, detail: p.summary, section: sectionOf(p.path), score: s });
    for (const h of p.headings) {
      const hs = score(h, 3);
      if (hs) hits.push({ key: `${p.path}#${h}`, path: p.path, href: `${p.path}#${slugify(h)}`, title: h, detail: p.title, heading: true, score: hs });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 12);
}

export function useSearchShortcut(open: () => void) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      // Inside a live workspace, ⌘K is its command palette.
      if (e.defaultPrevented || (e.target instanceof Element && e.target.closest("[data-jali]"))) return;
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); open(); }
      else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); open(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
}

export const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const hits = useMemo(() => search(q), [q]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); setQ(""); setActive(0); requestAnimationFrame(() => input.current?.focus()); }
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    document.getElementById(`search-hit-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (h: Hit | undefined) => {
    if (!h) return;
    onClose();
    navigate(h.href);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(hits.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); go(hits[active]); }
  };

  return (
    <dialog ref={ref} className="search-dialog" aria-label="Search the docs" onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="search-panel">
        <div className="search-field">
          <SearchIcon aria-hidden size={18} strokeWidth={1.75} />
          <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Search the docs" aria-label="Search the docs" role="combobox" aria-expanded="true"
            aria-controls="search-results" aria-activedescendant={hits.length ? `search-hit-${active}` : undefined} autoComplete="off" spellCheck={false} />
          <kbd className="kbd" onClick={onClose}>Esc</kbd>
        </div>
        <ul id="search-results" className="search-results" role="listbox" aria-label={q ? "Results" : "Pages"}>
          {!q ? <li className="search-group" role="presentation">Pages</li> : null}
          {hits.map((h, i) => (
            <li key={h.key} id={`search-hit-${i}`} role="option" aria-selected={i === active} className="search-hit"
              onMouseMove={() => setActive(i)} onClick={() => go(h)}>
              <span className="search-hit-icon">{h.heading ? <Hash aria-hidden size={15} /> : <FileText aria-hidden size={15} strokeWidth={1.75} />}</span>
              <span className="search-hit-text">
                <span className="search-hit-title">{h.title}</span>
                <span className="search-hit-detail">{h.heading ? `In ${h.detail}` : h.detail}</span>
              </span>
              {i === active ? <CornerDownLeft aria-hidden className="search-hit-enter" size={14} /> : null}
            </li>
          ))}
          {q && !hits.length ? <li className="search-empty" role="presentation">Nothing matches “{q}”. Try a shorter word.</li> : null}
        </ul>
        <div className="search-foot" aria-hidden>
          <span><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> to move</span>
          <span><kbd className="kbd">↵</kbd> to open</span>
        </div>
      </div>
    </dialog>
  );
}
