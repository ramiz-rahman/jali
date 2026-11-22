import { cssString } from "@jali/core/adapter";
import type { NodeId } from "@jali/core";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useJaliIcons } from "../icons/context";
import type { Frame, Tab } from "@jali/core/adapter";
import { scrolledFromStart, observeResize } from "@jali/core/adapter";
import { useStore, useUi } from "../state/react";
import { useCanRename } from "./rename";
import { TabIndicator } from "./TabIndicator";
import { TabItem } from "./TabItem";
import { tabGroups } from "./tabGroups";
import { TabMenu, type TabMenuAt } from "./TabMenu";
import { TabOverflow } from "./TabOverflow";
import { ICON } from "../icons/sized";
import { useRovingKeys } from "../a11y/roving";

/** The edge fade's width (pane.css): a revealed tab clears it, unless it is at the strip's end. */
const FADE = 24;

/**
 * Keep the active tab visible by scrolling only the tab strip (scrollIntoView would also move the layout). Measured
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

/** A group's tabs. `owner` is the frame showing the group: the active tab's title labels its region. */
export function TabStrip({ group, owner }: { group: NonNullable<Frame["group"]>; owner: NodeId }) {
  const icon = useJaliIcons();
  const store = useStore();
  const { actions, env } = store;
  const tw = store.messages.tabs;
  // A curated page, or an instance without a launcher: no "+" (its views come from the page's tabs).
  const page = useUi((s) => !!s.page);
  // A tab dragged over this strip: the line shows where it would go.
  const dropAt = useUi((s) => s.dnd?.tabAt);
  const dir = useUi((s) => s.dir);
  const renaming = useUi((s) => s.renaming);
  const canRename = useCanRename();
  // Made by you first, made by the layout (folded) after a hairline: the second kind returns by itself. Each tab hears
  // what its own pane reports (TabItem); the strip renders again for none of it.
  const {
    listed: tabs,
    mine,
    pinned,
    scrolling,
    shownFolded: folded,
    foldedAway,
    activeIn,
  } = tabGroups(group, page);

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
  // The count as last set: an unchanged count sets no state, as a functional update right after a commit renders the
  // strip again to find it unchanged.
  const counted = useRef(0);
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
    if (counted.current !== n) setHiddenCount((counted.current = n));
    // Fade an edge that has tabs past it, so a cut-off tab reads as "more this way" (like the shelf).
    // No fade while the shown tab fills the strip: it is shortened to fit, and a fade would hide its ×.
    const fills = !!shown && want >= el.clientWidth - 1;
    const { pos, max, rtl } = scrolledFromStart(el);
    el.toggleAttribute(rtl ? "data-fade-r" : "data-fade-l", !fills && pos > 1);
    el.toggleAttribute(rtl ? "data-fade-l" : "data-fade-r", !fills && pos < max - 1);
  };
  // Measured again when what the strip lays out changes, not on every render (a resize of the frame is the observer's).
  const laidOut = `${group.active} ${tabs.map((t) => `${t.node.id}:${+!!t.node.pinned}${+t.tucked}${+t.folded}`)}`;
  useLayoutEffect(measure, [laidOut, dropAt, dir, renaming, page, canRename, hiddenCount]);
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

  const renderTab = (tab: Tab) => (
    <TabItem
      key={tab.node.id}
      tab={tab}
      group={group.id}
      active={tab.node.id === group.active}
      owner={owner}
      renaming={renaming === tab.node.id}
      drop={dropAt?.tab === tab.node.id ? dropAt.side : undefined}
      canRename={canRename}
      dir={dir}
      reveal={revealTab}
      onMenu={setMenu}
      onLaidOut={measure}
    />
  );

  // One underline per strip, in the part that holds the shown tab; none while it is renamed.
  const indicator = <TabIndicator active={group.active} hidden={renaming === group.active} />;

  return (
    <div className="jali-tabbar" ref={bar}>
      <div
        className="jali-tablist"
        role="tablist"
        aria-label={tw.listLabel(mine.length + folded.length)}
        onKeyDown={tabKeys}
      >
        {pinned.length ? (
          <div className="jali-tabs-pinned">
            {pinned.map(renderTab)}
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
      {/* No launcher kind, no "+": there is nothing to open in the new tab. */}
      {page || !env.launcher ? null : (
        <button
          type="button"
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
