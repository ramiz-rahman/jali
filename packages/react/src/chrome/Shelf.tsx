import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useJaliIcons } from "../icons/context";
import type { ShelfEntry, JaliModel, PaneActivity } from "@jali/core/adapter";
import { useShortcut } from "../commands/react";
import {
  flashTab,
  inlineStep,
  scrolledFromStart,
  FOLDED_DESC,
  FOLDED_TIP,
} from "@jali/core/adapter";
import { Activity, shelfActivity } from "../pane/Activity";
import { KindIcon } from "../pane/icons";
import { useActions, useModel, useStore, useUi } from "../state/react";

function label(m: JaliModel, it: ShelfEntry, a: PaneActivity | undefined) {
  const node = m.pane(it.paneId);
  const title = m.title(it.paneId);
  const home = m.title(it.homeId);
  const word = shelfActivity(a)?.word;
  const folded = it.reason === "folded";
  return {
    node,
    title,
    home,
    folded,
    state: shelfActivity(a)?.state ?? "idle",
    full: `${title}${word ? `, ${word}` : ""}, ${folded ? "folded" : `behind ${home}`}`,
  };
}

/** The shelf: tucked and folded panes, as chips by home. Renders nothing unless something is tucked or folded. */
const FOLDED_CHIPS = 3;
const SUMMARY = "folded-summary";

export function Shelf() {
  const icon = useJaliIcons();
  const m = useModel();
  // Every pane that is a tab but not by choice is listed too: tucked (yours, can be put back) and folded (the layout's).
  const tuckedItems = m.shelf;
  const foldedItems = useMemo(
    () =>
      m.resolved.shelf.filter(
        (e) => e.reason === "folded" && !tuckedItems.some((t) => t.paneId === e.paneId),
      ),
    [m.resolved.shelf, tuckedItems],
  );
  const items = useMemo(() => [...tuckedItems, ...foldedItems], [tuckedItems, foldedItems]);
  const activity = useUi((s) => s.activity);
  const dir = useUi((s) => s.dir);
  const actions = useActions();
  const store = useStore();
  const putBackShortcut = useShortcut("pane.putBack");
  const putBackKeys = putBackShortcut ? ` · ${putBackShortcut}` : "";
  const doReveal = (it: ShelfEntry) => {
    actions.reveal(it.paneId);
    flashTab(store.dom, it.paneId);
  };
  const [focusId, setFocusId] = useState<string | null>(null);
  // The +N list (chips scrolled out of view) or, past FOLDED_CHIPS folded panes, the folded list behind one summary chip.
  const [menu, setMenu] = useState<false | "more" | "folded">(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    const byHome = new Map<string, ShelfEntry[]>();
    for (const it of tuckedItems) byHome.set(it.homeId, [...(byHome.get(it.homeId) ?? []), it]);
    return [...byHome.entries()];
  }, [tuckedItems]);
  // Keyboard order is the order on screen (grouped by home), not the store's order.
  // Folded panes return on their own: past a few, one summary chip lists them instead of a row of chips.
  const summarise = foldedItems.length > FOLDED_CHIPS;
  const ids = [
    ...groups.flatMap(([, list]) => list.map((i) => i.paneId)),
    ...(summarise ? [SUMMARY] : foldedItems.map((i) => i.paneId)),
  ];
  const tab = focusId && ids.includes(focusId) ? focusId : ids[0];

  // Fade edges and the +N list: chips scrolled out of view.
  const measure = () => {
    const sc = scroller.current,
      b = bar.current;
    if (!sc || !b) return;
    // Chips past the start (left, or right when the shelf reads right to left) and past the end.
    const { pos, max, rtl } = scrolledFromStart(sc);
    b.toggleAttribute(rtl ? "data-fade-r" : "data-fade-l", pos > 1);
    b.toggleAttribute(rtl ? "data-fade-l" : "data-fade-r", pos < max - 1);
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
    const off = (e: MouseEvent) => {
      if (
        !(e.target as HTMLElement).closest(
          ".jali-shelf-menu, .jali-shelf-more, .jali-shelf-summary",
        )
      )
        setMenu(false);
    };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [menu]);

  if (!items.length) return null;

  const focusChip = (id: string) => {
    setFocusId(id);
    requestAnimationFrame(() => {
      const el = scroller.current?.querySelector<HTMLElement>(
        `[data-chip="${id}"] .jali-shelf-chip-main`,
      );
      el?.focus();
      el?.scrollIntoView({ inline: "nearest", block: "nearest" });
    });
  };
  const onKey = (e: KeyboardEvent) => {
    const cur = (e.target as HTMLElement).closest<HTMLElement>("[data-chip]")?.dataset.chip;
    if (!cur) return;
    const i = ids.indexOf(cur);
    const go = (n: number) => {
      e.preventDefault();
      focusChip(ids[(n + ids.length) % ids.length]!);
    };
    const step = inlineStep(e.key, dir);
    if (step) go(i + step);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(ids.length - 1);
    else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      if (items.find((x) => x.paneId === cur)?.reason !== "tucked") return;
      const next = ids[i + 1] ?? ids[i - 1];
      actions.putBack(cur);
      if (next) setFocusId(next);
    } else if ((e.key === "Enter" || e.key === " ") && cur === SUMMARY) {
      e.preventDefault();
      setMenu((v) => (v === "folded" ? false : "folded"));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const it = items.find((x) => x.paneId === cur);
      if (it) doReveal(it);
    }
  };

  const chip = (it: ShelfEntry) => {
    const L = label(m, it, activity[it.paneId]);
    return (
      <div
        className={`jali-shelf-chip${L.folded ? " is-folded" : ""}`}
        data-chip={it.paneId}
        data-reason={it.reason}
        data-activity={L.state}
        key={it.paneId}
      >
        <button
          className="jali-shelf-chip-main"
          tabIndex={it.paneId === tab ? 0 : -1}
          aria-label={`${L.full}. Enter shows it${it.reason === "tucked" ? ", Shift+Enter puts it back" : ""}`}
          aria-description={L.folded ? FOLDED_DESC : undefined}
          title={L.folded ? `${L.title} · ${FOLDED_TIP}` : `${L.title} · behind ${L.home}`}
          onFocus={() => setFocusId(it.paneId)}
          onClick={() => doReveal(it)}
        >
          {L.folded ? (
            <icon.fold size={13} aria-hidden />
          ) : L.node ? (
            <KindIcon kind={L.node.ref.kind} size={13} />
          ) : null}
          <span className="jali-shelf-chip-title">{L.title}</span>
          <Activity a={activity[it.paneId]} shape />
        </button>
        {it.reason === "tucked" ? (
          <button
            className="jali-shelf-chip-put"
            tabIndex={-1}
            aria-label={`Put back ${L.title}`}
            title={`Put back${putBackKeys}`}
            onClick={() => actions.putBack(it.paneId)}
          >
            <icon.putBack size={13} aria-hidden />
          </button>
        ) : null}
      </div>
    );
  };

  const hidden = items.filter((i) => hiddenIds.includes(i.paneId));
  const listed = menu === "folded" ? foldedItems : hidden;
  return (
    <div className="jali-shelf" role="region" aria-label="Shelf" tabIndex={-1} data-shelf>
      <div className="jali-shelf-bar" ref={bar}>
        <span className="jali-shelf-fade jali-shelf-fade-l" aria-hidden />
        <div
          className="jali-shelf-scroll"
          ref={scroller}
          role="toolbar"
          aria-label="Tucked and folded panes"
          aria-orientation="horizontal"
          onKeyDown={onKey}
          onScroll={measure}
        >
          {groups.map(([home, list]) => (
            <div
              className="jali-shelf-group"
              role="group"
              aria-label={`Behind ${m.title(home)}`}
              key={home}
            >
              <span className="jali-shelf-home">Behind {m.title(home)}:</span>
              {list.map(chip)}
            </div>
          ))}
          {foldedItems.length && summarise ? (
            <div
              className="jali-shelf-group is-folded"
              role="group"
              aria-label="Folded"
              key="folded"
            >
              <div
                className="jali-shelf-chip is-folded jali-shelf-summary"
                data-chip={SUMMARY}
                data-reason="folded"
                data-summary
              >
                <button
                  className="jali-shelf-chip-main"
                  tabIndex={tab === SUMMARY ? 0 : -1}
                  aria-haspopup="menu"
                  aria-expanded={menu === "folded"}
                  aria-label={`${foldedItems.length} folded panes. Enter lists them`}
                  aria-description={FOLDED_DESC}
                  title={FOLDED_TIP}
                  onFocus={() => setFocusId(SUMMARY)}
                  onClick={() => setMenu((v) => (v === "folded" ? false : "folded"))}
                >
                  <icon.fold size={13} aria-hidden />
                  <span className="jali-shelf-chip-title">{foldedItems.length} folded</span>
                </button>
              </div>
            </div>
          ) : foldedItems.length ? (
            <div
              className="jali-shelf-group is-folded"
              role="group"
              aria-label="Folded"
              key="folded"
            >
              <span className="jali-shelf-home" title={FOLDED_TIP}>
                <icon.fold size={12} aria-hidden /> Folded:
              </span>
              {foldedItems.map(chip)}
            </div>
          ) : null}
        </div>
        <span className="jali-shelf-fade jali-shelf-fade-r" aria-hidden />
      </div>
      {hidden.length ? (
        <button
          className="jali-shelf-more"
          aria-haspopup="menu"
          aria-expanded={menu === "more"}
          aria-label={`${hidden.length} more tucked or folded panes`}
          onClick={() => setMenu((v) => (v === "more" ? false : "more"))}
        >
          +{hidden.length}
        </button>
      ) : null}
      {menu ? (
        <div
          className="jali-shelf-menu"
          role="menu"
          aria-label={menu === "folded" ? "Folded panes" : "More tucked or folded panes"}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setMenu(false);
              if (menu === "folded") focusChip(SUMMARY);
            }
          }}
        >
          {listed.map((it) => {
            const L = label(m, it, activity[it.paneId]);
            return (
              <button
                role="menuitem"
                key={it.paneId}
                onClick={() => {
                  setMenu(false);
                  doReveal(it);
                }}
              >
                {L.node ? <KindIcon kind={L.node.ref.kind} size={14} /> : null}
                <span className="jali-shelf-chip-title">{L.title}</span>
                <Activity a={activity[it.paneId]} shape />
                <small>{L.folded ? "folded" : `behind ${L.home}`}</small>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
