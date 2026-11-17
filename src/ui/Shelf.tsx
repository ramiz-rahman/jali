import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Undo2, X } from "lucide-react";
import { KindIcon } from "./PaneFrame";
import { findPane, titleOf, useUi } from "./store";
import { paneTitle } from "./pane-kinds";
import { flashTab, putBack, reveal, useShelf, type ShelfItem } from "./pane/tuck";

type Act = "working" | "needs-you" | "done" | "failed" | "idle";
const WORD: Record<Act, string> = { working: "working", "needs-you": "needs you", done: "finished, not yet seen", failed: "failed", idle: "" };

function norm(a: string | undefined): Act {
  if (!a) return "idle";
  if (a === "working" || a === "loading") return "working";
  if (a === "needs-you" || a === "blocked") return "needs-you";
  if (a === "error" || a === "failed") return "failed";
  if (a.startsWith("done")) return "done";
  return "idle";
}

/** Activity with a shape as well as a colour: ring, "!", dot, cross. */
export function ShelfDot({ a }: { a: Act }) {
  if (a === "working") return <span className="ra ra-ring" aria-hidden />;
  if (a === "needs-you") return <span className="ra ra-need" aria-hidden>!</span>;
  if (a === "failed") return <span className="ra ra-fail" aria-hidden><X size={8} strokeWidth={3.5} /></span>;
  if (a === "done") return <span className="ra ra-done" aria-hidden />;
  return null;
}

function label(it: ShelfItem) {
  const node = findPane(it.paneId);
  const title = node ? paneTitle(node.ref) : titleOf(it.paneId);
  const a = norm(it.activity);
  return { node, title, a, home: titleOf(it.homeId), full: `${title}${a !== "idle" ? `, ${WORD[a]}` : ""}, behind ${titleOf(it.homeId)}` };
}

function doReveal(it: ShelfItem) {
  reveal(it.paneId);
  flashTab(it.paneId);
}

/** The shelf: tucked panes by home. Hidden unless something is tucked. */
export function Shelf() {
  const items = useShelf();
  useUi((s) => s.layout);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    const m = new Map<string, ShelfItem[]>();
    for (const it of items) m.set(it.homeId, [...(m.get(it.homeId) ?? []), it]);
    return [...m.entries()];
  }, [items]);
  const ids = items.map((i) => i.paneId);
  const tab = focusId && ids.includes(focusId) ? focusId : ids[0];

  // Fade edges and the +N list: chips scrolled out of view.
  const measure = () => {
    const sc = scroller.current, b = bar.current;
    if (!sc || !b) return;
    const l = sc.scrollLeft > 1, r = sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 1;
    b.toggleAttribute("data-fade-l", l);
    b.toggleAttribute("data-fade-r", r);
    const box = sc.getBoundingClientRect();
    const out: string[] = [];
    sc.querySelectorAll<HTMLElement>("[data-chip]").forEach((c) => {
      const cr = c.getBoundingClientRect();
      if (cr.left < box.left - 1 || cr.right > box.right + 1) out.push(c.dataset.chip!);
    });
    setHiddenIds((p) => (p.join() === out.join() ? p : out));
  };
  useLayoutEffect(measure);
  useEffect(() => {
    const sc = scroller.current;
    if (!sc) return;
    const ro = new ResizeObserver(measure);
    ro.observe(sc);
    return () => ro.disconnect();
  }, [items.length]);
  useEffect(() => {
    if (!menu) return;
    const off = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".shelf-menu, .shelf-more")) setMenu(false); };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [menu]);

  if (!items.length) return null;

  const focusChip = (id: string) => {
    setFocusId(id);
    requestAnimationFrame(() => {
      const el = scroller.current?.querySelector<HTMLElement>(`[data-chip="${id}"] .shelf-chip-main`);
      el?.focus();
      el?.scrollIntoView({ inline: "nearest", block: "nearest" });
    });
  };
  const onKey = (e: KeyboardEvent) => {
    const cur = (e.target as HTMLElement).closest<HTMLElement>("[data-chip]")?.dataset.chip;
    if (!cur) return;
    const i = ids.indexOf(cur);
    const go = (n: number) => { e.preventDefault(); focusChip(ids[(n + ids.length) % ids.length]!); };
    if (e.key === "ArrowRight") go(i + 1);
    else if (e.key === "ArrowLeft") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(ids.length - 1);
    else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      const next = ids[i + 1] ?? ids[i - 1];
      putBack(cur);
      if (next) setFocusId(next);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const it = items.find((x) => x.paneId === cur);
      if (it) doReveal(it);
    }
  };

  const hidden = items.filter((i) => hiddenIds.includes(i.paneId));
  return (
    <div className="shelf" role="region" aria-label="Shelf" tabIndex={-1} data-shelf>
      <span className="shelf-label" aria-hidden>Tucked</span>
      <div className="shelf-bar" ref={bar}>
        <span className="shelf-fade shelf-fade-l" aria-hidden />
        <div className="shelf-scroll" ref={scroller} role="toolbar" aria-label="Tucked panes" aria-orientation="horizontal" onKeyDown={onKey} onScroll={measure}>
          {groups.map(([home, list]) => (
            <div className="shelf-group" role="group" aria-label={`Behind ${titleOf(home)}`} key={home}>
              <span className="shelf-home">Behind {titleOf(home)}:</span>
              {list.map((it) => {
                const L = label(it);
                return (
                  <div className="shelf-chip" data-chip={it.paneId} data-activity={L.a} key={it.paneId}>
                    <button
                      className="shelf-chip-main"
                      tabIndex={it.paneId === tab ? 0 : -1}
                      aria-label={`${L.full}. Enter shows it, Shift+Enter puts it back`}
                      title={`${L.title} · behind ${L.home}`}
                      onFocus={() => setFocusId(it.paneId)}
                      onClick={() => doReveal(it)}
                    >
                      {L.node ? <KindIcon kind={L.node.ref.kind} size={14} /> : null}
                      <span className="shelf-chip-title">{L.title}</span>
                      <ShelfDot a={L.a} />
                    </button>
                    <button className="shelf-chip-put" tabIndex={-1} aria-label={`Put back ${L.title}`} title="Put back · ⌥⇧⌘M" onClick={() => putBack(it.paneId)}>
                      <Undo2 size={13} strokeWidth={1.75} aria-hidden />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <span className="shelf-fade shelf-fade-r" aria-hidden />
      </div>
      {hidden.length ? (
        <button className="shelf-more" aria-haspopup="menu" aria-expanded={menu} aria-label={`${hidden.length} more tucked panes`} onClick={() => setMenu((m) => !m)}>
          +{hidden.length}
        </button>
      ) : null}
      {menu ? (
        <div className="shelf-menu" role="menu" aria-label="More tucked panes" onKeyDown={(e) => { if (e.key === "Escape") setMenu(false); }}>
          {hidden.map((it) => {
            const L = label(it);
            return (
              <button role="menuitem" key={it.paneId} onClick={() => { setMenu(false); doReveal(it); }}>
                {L.node ? <KindIcon kind={L.node.ref.kind} size={14} /> : null}
                <span className="shelf-chip-title">{L.title}</span>
                <ShelfDot a={L.a} />
                <small>behind {L.home}</small>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
