/**
 * Search over page titles, summaries, headings and reference entries, in a modal dialog. ⌘K, Ctrl+K or "/" opens it
 * (./enhance.ts). Loaded the first time it is wanted; it reads the index the build wrote (/search.json,
 * src/pages/search.json.ts), not the pages. A stand-in until Pagefind searches the built pages (docs/DOCS-PLAN.md).
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  ArrowElbowDownLeftIcon,
  BracketsCurlyIcon,
  FileTextIcon,
  HashIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import type { SearchIndex } from "../site/search-index";

interface Hit {
  key: string;
  href: string;
  title: string;
  detail: string;
  kind: "page" | "heading" | "entry";
}

let index: Promise<SearchIndex> | null = null;
const loadIndex = () =>
  (index ??= fetch("/search.json").then((r) => {
    if (!r.ok) throw new Error(`search.json: ${r.status}`);
    return r.json() as Promise<SearchIndex>;
  }));

function search(data: SearchIndex, q: string): Hit[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length)
    return data.pages.slice(0, 8).map((p) => ({
      key: p.path,
      href: p.path,
      title: p.title,
      detail: p.summary,
      kind: "page",
    }));
  const hits: (Hit & { score: number })[] = [];
  const score = (text: string, w: number) => {
    const t = text.toLowerCase();
    if (!terms.every((x) => t.includes(x))) return 0;
    return w * (t.startsWith(terms[0]!) ? 2 : 1);
  };
  for (const p of data.pages) {
    const s = score(p.title, 6) + score(p.summary, 2) + score(`${p.title} ${p.summary}`, 1);
    if (s)
      hits.push({
        key: p.path,
        href: p.path,
        title: p.title,
        detail: p.summary,
        kind: "page",
        score: s,
      });
    for (const h of p.headings) {
      // A reference entry is looked up by its exact name, so a name that starts with the words ranks first.
      const hs = score(h.text, h.entry ? 4 : 3);
      if (hs)
        hits.push({
          key: `${p.path}#${h.id}`,
          href: `${p.path}#${h.id}`,
          title: h.text,
          detail: p.title,
          kind: h.entry ? "entry" : "heading",
          score: hs,
        });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 12);
}

const ICON = { page: FileTextIcon, heading: HashIcon, entry: BracketsCurlyIcon };

function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<SearchIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const hits = useMemo(() => (data ? search(data, q) : []), [data, q]);

  useEffect(() => {
    loadIndex().then(setData, () => setFailed(true));
  }, []);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setQ("");
      setActive(0);
      input.current?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    document.getElementById(`search-hit-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (h: Hit | undefined) => {
    if (!h) return;
    onClose();
    window.location.assign(h.href);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(hits.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(hits[active]);
    }
  };

  return (
    <dialog
      ref={ref}
      className="search-dialog"
      aria-label="Search the docs"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="search-panel">
        <div className="search-field">
          <MagnifyingGlassIcon aria-hidden size={18} />
          <input
            ref={input}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search the docs"
            aria-label="Search the docs"
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            aria-activedescendant={hits.length ? `search-hit-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="kbd" onClick={onClose}>
            Esc
          </kbd>
        </div>
        <ul
          id="search-results"
          className="search-results"
          role="listbox"
          aria-label={q ? "Results" : "Pages"}
          aria-busy={!data && !failed}
        >
          {!q && data ? (
            <li className="search-group" role="presentation">
              Pages
            </li>
          ) : null}
          {hits.map((h, i) => {
            const Icon = ICON[h.kind];
            return (
              <li
                key={h.key}
                id={`search-hit-${i}`}
                role="option"
                aria-selected={i === active}
                className="search-hit"
                onMouseMove={() => setActive(i)}
                onClick={() => go(h)}
              >
                <span className="search-hit-icon">
                  <Icon aria-hidden size={15} />
                </span>
                <span className="search-hit-text">
                  <span className="search-hit-title">{h.title}</span>
                  <span className="search-hit-detail">
                    {h.kind === "page" ? h.detail : `In ${h.detail}`}
                  </span>
                </span>
                {i === active ? (
                  <ArrowElbowDownLeftIcon aria-hidden className="search-hit-enter" size={14} />
                ) : null}
              </li>
            );
          })}
          {failed ? (
            <li className="search-empty" role="presentation">
              Search didn't load. Check your connection and try again.
            </li>
          ) : q && data && !hits.length ? (
            <li className="search-empty" role="presentation">
              Nothing matches “{q}”. Try a shorter word.
            </li>
          ) : null}
        </ul>
        <div className="search-foot" aria-hidden>
          <span>
            <kbd className="kbd">↑</kbd>
            <kbd className="kbd">↓</kbd> to move
          </span>
          <span>
            <kbd className="kbd">↵</kbd> to open
          </span>
        </div>
      </div>
    </dialog>
  );
}

let root: Root | null = null;
let setOpen: ((open: boolean) => void) | null = null;

function SearchApp() {
  const [open, set] = useState(true);
  useEffect(() => {
    setOpen = set;
  }, []);
  return <SearchDialog open={open} onClose={() => set(false)} />;
}

/** Opens the dialog, rendering it the first time. */
export function openSearch() {
  if (setOpen) return setOpen(true);
  if (root) return;
  const host = document.createElement("div");
  host.id = "search-root";
  document.body.append(host);
  root = createRoot(host);
  root.render(<SearchApp />);
}

void loadIndex().catch(() => {});
