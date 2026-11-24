/**
 * Search over page titles, summaries, headings and reference entries, in a modal dialog. ⌘K, Ctrl+K or "/" opens it
 * (src/shell/search.client.ts). Loaded the first time it is wanted; it reads the index the build wrote (/search.json,
 * src/pages/search.json.ts), not the pages, and ranks with src/site/search-index.ts. A stand-in until Pagefind
 * searches the built pages (docs/DOCS-PLAN.md).
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
import { searchIndex, type Hit, type SearchIndex } from "../site/search-index";

let index: Promise<SearchIndex> | null = null;
const loadIndex = () =>
  (index ??= fetch("/search.json").then((r) => {
    if (!r.ok) throw new Error(`search.json: ${r.status}`);
    return r.json() as Promise<SearchIndex>;
  }));

const ICON = { page: FileTextIcon, heading: HashIcon, entry: BracketsCurlyIcon };

function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [data, setData] = useState<SearchIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const hits = useMemo(() => (data ? searchIndex(data, q) : []), [data, q]);

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
      // Each opening starts at the top, the "Pages" heading in sight, not where the last search was scrolled to.
      if (list.current) list.current.scrollTop = 0;
      input.current?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    // Back on the first result, the list goes to its very top, so the heading above it shows too.
    if (active === 0) list.current?.scrollTo({ top: 0 });
    else document.getElementById(`search-hit-${active}`)?.scrollIntoView({ block: "nearest" });
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
      // The browser's close event comes a moment after the close: one from an earlier close can arrive after a quick
      // reopen, and must not shut the dialog that is open now.
      onClose={() => {
        if (!ref.current?.open) onClose();
      }}
      // Esc closes it from anywhere inside, by the dialog's own hand: the browser's built-in close on Esc can be
      // cancelled by another listener on the page or an extension, and then nothing would happen.
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        onClose();
      }}
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
          ref={list}
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

/** Draws the dialog, open or closed: the same root each time, so it keeps what it has loaded. */
function render(open: boolean) {
  root?.render(<SearchDialog open={open} onClose={() => render(false)} />);
}

/** Opens the dialog, rendering it the first time. */
export function openSearch() {
  if (!root) {
    const host = document.createElement("div");
    host.id = "search-root";
    document.body.append(host);
    root = createRoot(host);
  }
  render(true);
}

void loadIndex().catch(() => {});
