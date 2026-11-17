import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Undo2 } from "lucide-react";
import type { ShelfEntry } from "../../layout-core/types";
import { shortcutLabel } from "../commands/registry";
import { flashTab } from "../dom/focus";
import { Activity, shelfActivity } from "../pane/Activity";
import { KindIcon } from "../pane/icons";
import { titleOf } from "../profile";
import type { WorkspaceModel } from "../state/model";
import { useActions, useModel, useUi } from "../state/react";
import type { PaneActivity } from "../pane-kinds";

function label(m: WorkspaceModel, it: ShelfEntry, a: PaneActivity | undefined) {
  const node = m.pane(it.paneId);
  const title = node ? titleOf(node) : m.title(it.paneId);
  const home = m.title(it.homeId);
  const word = shelfActivity(a)?.word;
  return { node, title, home, state: shelfActivity(a)?.state ?? "idle", full: `${title}${word ? `, ${word}` : ""}, behind ${home}` };
}

/** The shelf: tucked panes by home, on the left of the status line. Renders nothing unless something is tucked. */
export function Shelf() {
  const m = useModel();
  const items = m.shelf;
  const activity = useUi((s) => s.activity);
  const actions = useActions();
  const doReveal = (it: ShelfEntry) => {
    actions.reveal(it.paneId);
    flashTab(it.paneId);
  };
  const [focusId, setFocusId] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    const byHome = new Map<string, ShelfEntry[]>();
    for (const it of items) byHome.set(it.homeId, [...(byHome.get(it.homeId) ?? []), it]);
    return [...byHome.entries()];
  }, [items]);
  // Keyboard order is the order on screen (grouped by home), not the store's order.
  const ids = groups.flatMap(([, list]) => list.map((i) => i.paneId));
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
      if (items.find((x) => x.paneId === cur)?.reason !== "tucked") return;
      const next = ids[i + 1] ?? ids[i - 1];
      actions.putBack(cur);
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
      <div className="shelf-bar" ref={bar}>
        <span className="shelf-fade shelf-fade-l" aria-hidden />
        <div className="shelf-scroll" ref={scroller} role="toolbar" aria-label="Tucked panes" aria-orientation="horizontal" onKeyDown={onKey} onScroll={measure}>
          {groups.map(([home, list]) => (
            <div className="shelf-group" role="group" aria-label={`Behind ${m.title(home)}`} key={home}>
              <span className="shelf-home">Behind {m.title(home)}:</span>
              {list.map((it) => {
                const L = label(m, it, activity[it.paneId]);
                return (
                  <div className="shelf-chip" data-chip={it.paneId} data-activity={L.state} key={it.paneId}>
                    <button
                      className="shelf-chip-main"
                      tabIndex={it.paneId === tab ? 0 : -1}
                      aria-label={`${L.full}. Enter shows it${it.reason === "tucked" ? ", Shift+Enter puts it back" : ""}`}
                      title={`${L.title} · behind ${L.home}`}
                      onFocus={() => setFocusId(it.paneId)}
                      onClick={() => doReveal(it)}
                    >
                      {L.node ? <KindIcon kind={L.node.ref.kind} size={13} /> : null}
                      <span className="shelf-chip-title">{L.title}</span>
                      <Activity a={activity[it.paneId]} shape />
                    </button>
                    {it.reason === "tucked" ? <button className="shelf-chip-put" tabIndex={-1} aria-label={`Put back ${L.title}`} title={`Put back · ${shortcutLabel("pane.putBack")}`} onClick={() => actions.putBack(it.paneId)}>
                      <Undo2 size={13} strokeWidth={1.75} aria-hidden />
                    </button> : null}
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
            const L = label(m, it, activity[it.paneId]);
            return (
              <button role="menuitem" key={it.paneId} onClick={() => { setMenu(false); doReveal(it); }}>
                {L.node ? <KindIcon kind={L.node.ref.kind} size={14} /> : null}
                <span className="shelf-chip-title">{L.title}</span>
                <Activity a={activity[it.paneId]} shape />
                <small>behind {L.home}</small>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
