import { own } from "@jali/core/adapter";
import type { ShelfEntry, PaneActivity } from "@jali/core";
import type { Model } from "@jali/core/adapter";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useJaliIcons } from "../icons/context";

import { useJaliShortcut } from "../commands/react";
import { cssString, flashTab, observeResize, scrolledFromStart } from "@jali/core/adapter";
import { useRovingKeys } from "../a11y/roving";
import { Menu } from "../a11y/Menu";
import { Activity, shelfActivity } from "../pane/Activity";
import { KindIcon } from "../pane/icons";
import { UnsavedMark } from "../pane/Unsaved";
import { useActions, useEntriesOf, useMessages, useModelValue, useStore } from "../state/react";
import { ICON } from "../icons/sized";
import { useLandmarkName } from "../a11y/landmark";

function label(m: Model, it: ShelfEntry, a: PaneActivity | undefined) {
  const node = m.pane(it.paneId);
  const title = m.title(it.paneId);
  const home = m.title(it.homeId);
  const folded = it.reason === "folded";
  return { node, title, home, folded, state: shelfActivity(a)?.state ?? "idle" };
}

/**
 * The shelf: the panes you tucked, as chips by home. Renders nothing unless something is tucked. Folded panes (the
 * layout's, for want of room) are not here: they wait behind their strip's "N folded" chip, so what you put away and
 * what the layout put away never look the same.
 */

export function Shelf() {
  const icon = useJaliIcons();
  const store = useStore();
  const landmarkName = useLandmarkName();
  // What it lists: the tucked panes (the model keeps the list until the layout changes), and their names and their
  // homes'. It renders again when one of those changes, never for another pane's title; the model is read as it renders.
  const tuckedItems = useModelValue((m) => m.shelf);
  useModelValue((m) =>
    JSON.stringify(m.shelf.map((it) => [m.title(it.paneId), m.title(it.homeId)])),
  );
  const m = store.model();
  const items = tuckedItems;
  // And what its chips' panes report: unsaved marks, what they are doing, data-* attributes.
  const chips = tuckedItems.map((it) => it.paneId);
  const unsaved = useEntriesOf((s) => s.unsaved, chips);
  const activity = useEntriesOf((s) => s.activity, chips);
  const marks = useEntriesOf((s) => s.paneAttributes, chips);
  const actions = useActions();
  const words = useMessages();
  const t = words.shelf;
  const putBackKeys = useJaliShortcut("pane.putBack");
  const doReveal = (it: ShelfEntry) => {
    actions.reveal(it.paneId);
    flashTab(store.dom, it.paneId);
  };
  const [focusId, setFocusId] = useState<string | null>(null);
  // The +N list: chips scrolled out of view.
  const [menu, setMenu] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const hiddenKey = useRef("[]");
  const scroller = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    const byHome = new Map<string, ShelfEntry[]>();
    for (const it of tuckedItems) byHome.set(it.homeId, [...(byHome.get(it.homeId) ?? []), it]);
    return [...byHome.entries()];
  }, [tuckedItems]);
  // ← → Home End along the chips, in the order on screen.
  const roving = useRovingKeys(
    () => [...(scroller.current?.querySelectorAll<HTMLElement>(".jali-shelf-chip-main") ?? [])],
    (el) => focusChip(el.closest<HTMLElement>("[data-chip]")!.dataset.chip!),
  );
  // Keyboard order is the order on screen (grouped by home), not the store's order.
  const ids = groups.flatMap(([, list]) => list.map((i) => i.paneId));
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
    // Set only when it changed: a functional update right after a commit renders the shelf again to find it the same.
    const key = JSON.stringify(out);
    if (hiddenKey.current !== key) {
      hiddenKey.current = key;
      setHiddenIds(out);
    }
  };
  useLayoutEffect(measure);
  useEffect(() => {
    const sc = scroller.current;
    return sc ? observeResize(sc, measure) : undefined;
  }, [items.length]);
  const more = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback((refocus: boolean) => {
    setMenu(false);
    if (refocus) more.current?.focus();
  }, []);

  if (!items.length) return null;

  const focusChip = (id: string) => {
    setFocusId(id);
    requestAnimationFrame(() => {
      const el = scroller.current?.querySelector<HTMLElement>(
        `[data-chip=${cssString(id)}] .jali-shelf-chip-main`,
      );
      el?.focus();
      el?.scrollIntoView({ inline: "nearest", block: "nearest" });
    });
  };
  const onKey = (e: KeyboardEvent) => {
    roving(e);
    const cur = (e.target as HTMLElement).closest<HTMLElement>("[data-chip]")?.dataset.chip;
    if (!cur || e.defaultPrevented) return;
    const i = ids.indexOf(cur);
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      const next = ids[i + 1] ?? ids[i - 1];
      actions.putBack(cur);
      if (next) setFocusId(next);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const it = items.find((x) => x.paneId === cur);
      if (it) doReveal(it);
    }
  };

  const chip = (it: ShelfEntry) => {
    const L = label(m, it, own(activity, it.paneId));
    const dirty = !!own(unsaved, it.paneId);
    const description = [dirty && words.pane.unsaved, L.folded && words.tabs.foldedDescription]
      .filter(Boolean)
      .join(". ");
    return (
      <div
        {...own(marks, it.paneId)}
        className={`jali-shelf-chip${L.folded ? " is-folded" : ""}`}
        data-chip={it.paneId}
        data-reason={it.reason}
        data-activity={L.state}
        data-unsaved={dirty || undefined}
        key={it.paneId}
        // The middle button closes the pane, as on a tab.
        onMouseDown={(e) => e.button === 1 && e.preventDefault()}
        onAuxClick={(e) => {
          if (e.button !== 1) return;
          e.preventDefault();
          actions.close(it.paneId);
        }}
      >
        <button
          type="button"
          className="jali-shelf-chip-main"
          tabIndex={it.paneId === tab ? 0 : -1}
          aria-label={t.chip({
            pane: L.title,
            home: L.home,
            reason: it.reason,
            activity: own(activity, it.paneId),
          })}
          aria-description={description || undefined}
          title={L.folded ? words.tabs.foldedTitle(L.title) : t.chipTip(L.title, L.home)}
          onFocus={() => setFocusId(it.paneId)}
          onClick={() => doReveal(it)}
        >
          {L.folded ? (
            <icon.fold {...ICON.shelf} aria-hidden />
          ) : L.node ? (
            <KindIcon kind={L.node.ref.kind} {...ICON.shelf} />
          ) : null}
          <span className="jali-shelf-chip-title">{L.title}</span>
          {dirty ? <UnsavedMark /> : null}
          <Activity a={own(activity, it.paneId)} shape />
        </button>
        {it.reason === "tucked" ? (
          <button
            type="button"
            className="jali-shelf-chip-put"
            tabIndex={-1}
            aria-label={t.putBack(L.title)}
            title={words.keys.withKeys(t.putBackTip, putBackKeys)}
            onClick={() => actions.putBack(it.paneId)}
          >
            <icon.putBack {...ICON.shelf} aria-hidden />
          </button>
        ) : null}
      </div>
    );
  };

  const hidden = items.filter((i) => hiddenIds.includes(i.paneId));
  return (
    <div
      className="jali-shelf"
      role="region"
      aria-label={landmarkName(t.label)}
      tabIndex={-1}
      data-shelf
    >
      <div className="jali-shelf-bar" ref={bar}>
        <span className="jali-shelf-fade jali-shelf-fade-l" aria-hidden />
        <div
          className="jali-shelf-scroll"
          ref={scroller}
          role="toolbar"
          aria-label={t.toolbar}
          aria-orientation="horizontal"
          onKeyDown={onKey}
          onScroll={measure}
        >
          {groups.map(([home, list]) => (
            <div
              className="jali-shelf-group"
              role="group"
              aria-label={t.behind(m.title(home))}
              key={home}
            >
              <span className="jali-shelf-home">{t.behindHeading(m.title(home))}</span>
              {list.map(chip)}
            </div>
          ))}
        </div>
        <span className="jali-shelf-fade jali-shelf-fade-r" aria-hidden />
      </div>
      {hidden.length ? (
        <button
          type="button"
          ref={more}
          className="jali-shelf-more"
          aria-haspopup="menu"
          aria-expanded={menu}
          aria-label={t.more(hidden.length)}
          onClick={() => setMenu((v) => !v)}
        >
          {t.moreCount(hidden.length)}
        </button>
      ) : null}
      {menu ? (
        <Menu
          className="jali-shelf-menu"
          aria-label={t.menuMore}
          onClose={closeMenu}
          trigger={more}
        >
          {hidden.map((it) => {
            const L = label(m, it, own(activity, it.paneId));
            return (
              <button
                type="button"
                {...own(marks, it.paneId)}
                className="jali-shelf-menu-item"
                role="menuitem"
                tabIndex={-1}
                key={it.paneId}
                onClick={() => {
                  setMenu(false);
                  doReveal(it);
                }}
              >
                {L.node ? <KindIcon kind={L.node.ref.kind} {...ICON.menu} /> : null}
                <span className="jali-shelf-chip-title">{L.title}</span>
                <Activity a={own(activity, it.paneId)} shape />
                <small>{t.where(L.folded, L.home)}</small>
              </button>
            );
          })}
        </Menu>
      ) : null}
    </div>
  );
}
