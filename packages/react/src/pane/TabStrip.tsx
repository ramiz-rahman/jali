import { own } from "@jali/core/adapter";
import type { NodeId, PaneNode } from "@jali/core";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useJaliIcons } from "../icons/context";
import type { Frame, Tab } from "@jali/core/adapter";
import { allows, cssString } from "@jali/core/adapter";
import {
  shortcutLabel,
  paneDomId,
  paneTitleId,
  roleOf,
  titleOf,
  startPaneDrag,
  scrolledFromStart,
  observeResize,
} from "@jali/core/adapter";
import { useEnv, useStore, useUi } from "../state/react";
import { Activity, activityLabel } from "./Activity";
import { KindIcon } from "./icons";
import { RenameField, useCanRename } from "./RenameField";
import { TabIndicator } from "./TabIndicator";
import { TabMenu, type TabMenuAt } from "./TabMenu";
import { TabOverflow } from "./TabOverflow";
import { UnsavedMark } from "./Unsaved";
import { ICON } from "../icons/sized";
import { useRovingKeys } from "../a11y/roving";

/** The edge fade's width (pane.css): a revealed tab clears it, unless it is at the strip's end. */
const FADE = 24;

/**
 * Keep the active tab visible by scrolling only the tab strip (scrollIntoView would also move the workspace). Measured
 * against the strip itself (a tab's offsetLeft is from the header). A tab wider than the strip shows its start.
 */
function revealTab(el: HTMLDivElement | null) {
  const strip = el?.closest<HTMLElement>(".jali-tabs");
  if (!el || !strip) return;
  // Measured from the strip's start: its left, or its right when the strip reads right to left.
  const { pos, rtl } = scrolledFromStart(strip);
  const r = el.getBoundingClientRect(),
    box = strip.getBoundingClientRect();
  const start = (rtl ? box.right - r.right : r.left - box.left) + pos;
  const end = start + el.offsetWidth;
  const view = strip.clientWidth;
  const scrollTo = (p: number) => (strip.scrollLeft = rtl ? -p : p);
  // A tab that fills the strip (shortened to fit, pane.css) shows from its start, with no fade before it.
  if (end - start >= view - 1) scrollTo(start);
  else if (start < pos + (pos > 0 ? FADE : 0)) scrollTo(Math.max(0, start - FADE));
  else if (end > pos + view) scrollTo(end - view + FADE);
}

function TabActivity({ id }: { id: NodeId }) {
  return <Activity a={useUi((s) => own(s.activity, id))} />;
}

/** A group's tabs. `owner` is the frame showing the group: the active tab's title labels its region. */
export function TabStrip({ group, owner }: { group: NonNullable<Frame["group"]>; owner: NodeId }) {
  const icon = useJaliIcons();
  const store = useStore();
  // A tab the app keeps open (`allow: { close: false }`) has no ×.
  const closable = (id: string) => allows(store.snapshot(), id, "close");
  const { actions, env } = store;
  const words = store.messages;
  const tw = words.tabs;
  // A curated page, or a workspace without a launcher: no "+" (its views come from the page's tabs).
  const page = useUi((s) => !!s.page);
  const titles = useUi((s) => s.titles);
  const marks = useUi((s) => s.paneAttributes);
  // Renders the strip again when what one of its own tabs is doing changes (read below), and for no other pane.
  useUi((s) => group.tabs.map((t) => own(s.activity, t.node.id) ?? "").join());
  const unsaved = useUi((s) => s.unsaved);
  // A tab dragged over this strip: the line shows where it would go.
  const dropAt = useUi((s) => s.dnd?.tabAt);
  const dir = useUi((s) => s.dir);
  const renaming = useUi((s) => s.renaming);
  const canRename = useCanRename();
  // No launcher kind, no "+": there is nothing to open in the new tab.
  // A curated page's views live in the page tabs, so a pane's strip lists a page view only while it is shown: never a
  // repeat. The exception is a group of page views, which only a centre drop ("Add as tab") makes: you asked for
  // those tabs, so it lists each view you put there (not ones the layout folded in).
  const placed = group.tabs.filter((t) => t.node.role && !t.folded);
  const tabs = !page
    ? group.tabs
    : group.tabs.filter(
        (t) => !t.node.role || t.node.id === group.active || (placed.length > 1 && !t.folded),
      );
  // Made by you first, made by the layout (folded) after a hairline: the second kind returns by itself.
  const mine = tabs.filter((t) => !t.folded);
  // The strip is for your tabs: of the panes the layout folded here, only the one shown is a tab; the rest wait behind
  // one "N folded" chip, so yours and the layout's never blend.
  // Pinned tabs stay in view at the strip's start, as in a browser: only the rest scroll.
  const pinnedTabs = mine.filter((t) => t.node.pinned);
  const scrolling = mine.filter((t) => !t.node.pinned);
  const folded = tabs.filter((t) => t.folded && t.node.id === group.active);
  const foldedAway = tabs.filter((t) => t.folded && t.node.id !== group.active);

  const strip = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<TabMenuAt | null>(null);
  const closeMenu = useCallback(
    (refocus: boolean) => {
      setMenu(null);
      if (menu && refocus)
        bar.current?.querySelector<HTMLElement>(`[data-tab=${cssString(menu.pane)}]`)?.focus();
    },
    [menu],
  );
  const [hiddenCount, setHiddenCount] = useState(0);
  const measure = () => {
    const el = strip.current;
    if (!el) return;
    // The scrolling part keeps room for the whole shown tab (pane.css): pinned tabs give way for it first.
    const shown = el.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    const want = shown?.parentElement?.offsetWidth ?? 0;
    if (el.style.getPropertyValue("--jali-shown-tab") !== `${want}px`)
      el.style.setProperty("--jali-shown-tab", `${want}px`);
    const box = el.getBoundingClientRect();
    let n = 0;
    // Out of view: tabs past either edge, but never the shown tab, which is revealed.
    el.querySelectorAll<HTMLElement>("[data-tab]").forEach((t) => {
      if (t === shown) return;
      const r = t.getBoundingClientRect();
      if (r.left < box.left - 1 || r.right > box.right + 1) n++;
    });
    setHiddenCount((p) => (p === n ? p : n));
    // Fade an edge that has tabs past it, so a cut-off tab reads as "more this way" (like the shelf).
    // No fade while the shown tab fills the strip: it is shortened to fit, and a fade would hide its ×.
    const fills = !!shown && want >= el.clientWidth - 1;
    const { pos, max, rtl } = scrolledFromStart(el);
    el.toggleAttribute(rtl ? "data-fade-r" : "data-fade-l", !fills && pos > 1);
    el.toggleAttribute(rtl ? "data-fade-l" : "data-fade-r", !fills && pos < max - 1);
  };
  // Measured again when what the strip lays out changes, not on every render (a resize of the frame is the observer's).
  const laidOut = `${group.active} ${tabs.map((t) => `${t.node.id}:${+!!t.node.pinned}${+t.tucked}${+t.folded}`)}`;
  useLayoutEffect(measure, [
    laidOut,
    titles,
    marks,
    unsaved,
    dropAt,
    dir,
    renaming,
    page,
    canRename,
    hiddenCount,
  ]);
  useEffect(() => {
    const el = strip.current;
    if (!el) return undefined;
    // A strip that changes size (the header narrowed, a title grew) shows its shown tab again, then counts.
    const resized = () => {
      revealTab(el.querySelector<HTMLDivElement>('[role="tab"][aria-selected="true"]'));
      measure();
    };
    const shown = () => el.querySelector('[role="tab"][aria-selected="true"]')?.parentElement;
    const offs = [observeResize(el, resized)];
    const item = shown();
    if (item) offs.push(observeResize(item, resized));
    return () => offs.forEach((off) => off());
  }, [group.active]);
  const overflowing = hiddenCount > 0;
  // ← → Home End move focus along the tabs; Enter, Space or a click shows one (APG tabs, manual activation).
  const tabKeys = useRovingKeys(() => [
    ...(bar.current?.querySelectorAll<HTMLElement>('.jali-tablist [role="tab"]') ?? []),
  ]);

  const putBackKeys = shortcutLabel(store, "pane.putBack");
  // A tab holds no controls (APG tabs, deletable tabs): its close and put back are its siblings in a presentational
  // wrapper. They are for the pointer: out of the tab order, and hidden from assistive technology, since a tablist may
  // own only tabs. The tab says what they do instead: Delete or Backspace closes it, and on a tucked tab the put back
  // command (which acts on a focused tucked tab) puts it back. Spacers inside the tab keep the buttons' room, so the
  // tab's box is as it was and the buttons sit on it.
  const renderTab = ({ node: t, tucked, folded: isFolded }: Tab) => {
    const active = t.id === group.active;
    const title = titleOf(store.env, t, titles);
    const dirty = !!own(unsaved, t.id);
    const pinned = !!t.pinned;
    // A tab behind says what its pane is doing ("Working"), as its dot shows; the shown tab's pane says it itself.
    const busy = active ? undefined : activityLabel(words.pane, own(store.get().activity, t.id));
    // Renaming: the field takes the tab's place until it closes.
    if (renaming === t.id)
      return (
        <div key={t.id} className="jali-tab-item is-renaming" role="presentation" data-renaming>
          <RenameField pane={t.id} title={title} />
        </div>
      );
    const description = tw.description(
      isFolded ? "folded" : tucked ? "tucked" : undefined,
      tucked ? putBackKeys : "",
    );
    return (
      <div
        key={t.id}
        className="jali-tab-item"
        role="presentation"
        data-drag-ok
        data-unsaved={dirty || undefined}
        data-drop={dropAt?.tab === t.id ? dropAt.side : undefined}
        data-pinned={pinned || undefined}
        onPointerDown={(e) => {
          e.stopPropagation();
          startPaneDrag(store, e, t.id);
        }}
        // The middle button closes a tab, as in a browser: the same close as its ×. Its press would start autoscroll.
        onMouseDown={(e) => e.button === 1 && e.preventDefault()}
        onAuxClick={(e) => {
          if (e.button !== 1) return;
          e.preventDefault();
          actions.close(t.id);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ pane: t.id, x: e.clientX, y: e.clientY });
        }}
      >
        <div
          {...own(marks, t.id)}
          ref={active ? revealTab : undefined}
          className={`jali-tab${active ? " is-active" : ""}${tucked ? " is-tucked" : ""}${isFolded ? " is-folded" : ""}`}
          data-tab={t.id}
          data-tucked={tucked || undefined}
          data-folded={isFolded || undefined}
          data-unsaved={dirty || undefined}
          aria-label={title}
          data-pinned={pinned || undefined}
          aria-description={[busy, pinned && tw.pinned, dirty && words.pane.unsaved, description]
            .filter(Boolean)
            .join(". ")}
          aria-keyshortcuts="Delete Backspace Shift+F10"
          aria-haspopup="menu"
          title={isFolded ? tw.foldedTitle(title) : title}
          role="tab"
          aria-selected={active}
          aria-controls={paneDomId(store.dom.id, t.id)}
          tabIndex={active ? 0 : -1}
          onClick={() => actions.setActiveTab(group.id, t.id)}
          onDoubleClick={() => canRename(t.id) && actions.startRename(t.id)}
          // Focus scrolls the strip by the browser's rule (a tab wider than the strip shows its end); put it right.
          onFocus={(e) => revealTab(e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              actions.setActiveTab(group.id, t.id);
            } else if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
              // The tab's menu from the keyboard: under the tab, at its start.
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              setMenu({ pane: t.id, x: dir === "rtl" ? r.right : r.left, y: r.bottom + 2 });
            } else if (
              (e.key === "Delete" || e.key === "Backspace") &&
              !(e.metaKey || e.ctrlKey || e.altKey || e.shiftKey)
            ) {
              e.preventDefault();
              actions.close(t.id);
            }
          }}
        >
          {pinned ? (
            <span className="jali-tab-pin" aria-hidden>
              <icon.pin {...ICON.tabSmall} />
            </span>
          ) : null}
          <TabIcon node={t} />
          <span
            className="jali-tab-title"
            id={active ? paneTitleId(store.dom.id, owner) : undefined}
          >
            {title}
          </span>
          <TabActivity id={t.id} />
          {isFolded ? (
            <span className="jali-tab-fold-mark" aria-hidden>
              <icon.fold {...ICON.tabMark} />
            </span>
          ) : null}
          {tucked ? <span className="jali-tab-space" aria-hidden /> : null}
          <span className="jali-tab-space" aria-hidden />
        </div>
        <span className="jali-tab-actions" aria-hidden>
          {tucked ? (
            <button
              className="jali-tab-putback"
              tabIndex={-1}
              aria-label={tw.putBack(title)}
              title={words.keys.withKeys(tw.putBackTip, putBackKeys)}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => actions.putBack(t.id)}
            >
              <icon.putBack {...ICON.tab} aria-hidden />
            </button>
          ) : null}
          {closable(t.id) ? (
            <button
              className="jali-tab-close"
              tabIndex={-1}
              aria-label={tw.close(title)}
              onClick={() => actions.close(t.id)}
            >
              <icon.close {...ICON.tab} aria-hidden />
              {dirty ? <UnsavedMark /> : null}
            </button>
          ) : dirty ? (
            <UnsavedMark />
          ) : null}
        </span>
      </div>
    );
  };

  // One underline per strip, in the part that holds the shown tab; none while it is renamed.
  const activeIn = pinnedTabs.some((t) => t.node.id === group.active)
    ? "pinned"
    : tabs.some((t) => t.node.id === group.active)
      ? "scrolling"
      : null;
  const indicator = <TabIndicator active={group.active} hidden={renaming === group.active} />;

  return (
    <div className="jali-tabbar" ref={bar}>
      <div
        className="jali-tablist"
        role="tablist"
        aria-label={tw.listLabel(mine.length + folded.length)}
        onKeyDown={tabKeys}
      >
        {pinnedTabs.length ? (
          <div className="jali-tabs-pinned">
            {pinnedTabs.map(renderTab)}
            {activeIn === "pinned" ? indicator : null}
          </div>
        ) : null}
        <div className="jali-tabs" ref={strip} onScroll={measure}>
          {scrolling.map(renderTab)}
          {folded.length && mine.length ? <span className="jali-tab-sep" aria-hidden /> : null}
          {folded.map(renderTab)}
          {activeIn === "scrolling" ? indicator : null}
        </div>
      </div>
      {menu ? <TabMenu at={menu} onClose={closeMenu} /> : null}
      {foldedAway.length ? (
        <TabOverflow
          folded
          tabs={foldedAway}
          active={group.active}
          onChoose={(id) => actions.setActiveTab(group.id, id)}
        />
      ) : null}
      {overflowing ? (
        <TabOverflow
          tabs={[...mine, ...folded, ...foldedAway]}
          active={group.active}
          hiddenCount={hiddenCount}
          onChoose={(id) => actions.setActiveTab(group.id, id)}
        />
      ) : null}
      {page || !env.launcher ? null : (
        <button
          className="jali-tab-add"
          aria-label={tw.newTab}
          title={tw.newTabTip}
          onClick={(e) => {
            e.stopPropagation();
            actions.newTab(group.active);
          }}
        >
          <icon.newTab {...ICON.tab} aria-hidden />
        </button>
      )}
    </div>
  );
}

/** A role tab shows its role's icon; anything else its kind's. */
function TabIcon({ node }: { node: PaneNode }) {
  const { profile } = useEnv();
  const role =
    useUi((s) => !!s.page) && node.role && profile ? roleOf(profile, node.role) : undefined;
  return role ? (
    <role.icon {...ICON.tab} aria-hidden />
  ) : (
    <KindIcon kind={node.ref.kind} {...ICON.tab} />
  );
}
