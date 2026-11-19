import type { NodeId, PaneNode } from "@jali/core";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useJaliIcons } from "../icons/context";
import type { Frame, Tab } from "@jali/core/adapter";
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
import { Activity } from "./Activity";
import { KindIcon } from "./icons";
import { TabOverflow } from "./TabOverflow";

/** The edge fade's width (pane.css): a revealed tab clears it, unless it is at the strip's end. */
const FADE = 24;

/**
 * Keep the active tab visible by scrolling only the tab strip (scrollIntoView would also move the workspace). Measured
 * against the strip itself (a tab's offsetLeft is from the header). A tab wider than the strip shows its start.
 */
function revealTab(el: HTMLDivElement | null) {
  const strip = el?.closest<HTMLElement>('[role="tablist"]');
  if (!el || !strip) return;
  // Measured from the strip's start: its left, or its right when the strip reads right to left.
  const { pos, rtl } = scrolledFromStart(strip);
  const r = el.getBoundingClientRect(),
    box = strip.getBoundingClientRect();
  const start = (rtl ? box.right - r.right : r.left - box.left) + pos;
  const end = start + el.offsetWidth;
  const view = strip.clientWidth;
  const scrollTo = (p: number) => (strip.scrollLeft = rtl ? -p : p);
  if (start < pos + (pos > 0 ? FADE : 0) || end - start > view) scrollTo(Math.max(0, start - FADE));
  else if (end > pos + view) scrollTo(end - view + FADE);
}

function TabActivity({ id }: { id: NodeId }) {
  return <Activity a={useUi((s) => s.activity[id])} />;
}

/** A group's tabs. `owner` is the frame showing the group: the active tab's title labels its region. */
export function TabStrip({ group, owner }: { group: NonNullable<Frame["group"]>; owner: NodeId }) {
  const icon = useJaliIcons();
  const store = useStore();
  const { actions, env } = store;
  const words = store.messages;
  const tw = words.tabs;
  // A curated page, or a workspace without a launcher: no "+" (its views come from the page's tabs).
  const page = useUi((s) => !!s.page);
  const titles = useUi((s) => s.titles);
  const marks = useUi((s) => s.paneAttributes);
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
  const folded = tabs.filter((t) => t.folded);

  const strip = useRef<HTMLDivElement>(null);
  const [hiddenCount, setHiddenCount] = useState(0);
  const measure = () => {
    const el = strip.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    let n = 0;
    el.querySelectorAll<HTMLElement>("[data-tab]").forEach((t) => {
      const r = t.getBoundingClientRect();
      if (r.left < box.left - 1 || r.right > box.right + 1) n++;
    });
    setHiddenCount((p) => (p === n ? p : n));
    // Fade an edge that has tabs past it, so a cut-off tab reads as "more this way" (like the shelf).
    const { pos, max, rtl } = scrolledFromStart(el);
    el.toggleAttribute(rtl ? "data-fade-r" : "data-fade-l", pos > 1);
    el.toggleAttribute(rtl ? "data-fade-l" : "data-fade-r", pos < max - 1);
  };
  useLayoutEffect(measure);
  useEffect(() => {
    const el = strip.current;
    return el ? observeResize(el, measure) : undefined;
  }, []);
  const overflowing = hiddenCount > 0;

  const putBackKeys = shortcutLabel(store, "pane.putBack");
  // A tab holds no controls (APG tabs, deletable tabs): its close and put back are its siblings in a presentational
  // wrapper. They are for the pointer: out of the tab order, and hidden from assistive technology, since a tablist may
  // own only tabs. The tab says what they do instead: Delete or Backspace closes it, and on a tucked tab the put back
  // command (which acts on a focused tucked tab) puts it back. Spacers inside the tab keep the buttons' room, so the
  // tab's box is as it was and the buttons sit on it.
  const renderTab = ({ node: t, tucked, folded: isFolded }: Tab) => {
    const active = t.id === group.active;
    const title = titleOf(store.env, t, titles);
    return (
      <div
        key={t.id}
        className="jali-tab-item"
        role="presentation"
        data-drag-ok
        onPointerDown={(e) => {
          e.stopPropagation();
          startPaneDrag(store, e, t.id);
        }}
      >
        <div
          {...marks[t.id]}
          ref={active ? revealTab : undefined}
          className={`jali-tab${active ? " is-active" : ""}${tucked ? " is-tucked" : ""}${isFolded ? " is-folded" : ""}`}
          data-tab={t.id}
          data-tucked={tucked || undefined}
          data-folded={isFolded || undefined}
          aria-label={title}
          aria-description={tw.description(
            isFolded ? "folded" : tucked ? "tucked" : undefined,
            tucked ? putBackKeys : "",
          )}
          aria-keyshortcuts="Delete Backspace"
          title={isFolded ? tw.foldedTitle(title) : title}
          role="tab"
          aria-selected={active}
          aria-controls={paneDomId(store.dom.id, t.id)}
          tabIndex={active ? 0 : -1}
          onClick={() => actions.setActiveTab(group.id, t.id)}
          // Focus scrolls the strip by the browser's rule (a tab wider than the strip shows its end); put it right.
          onFocus={(e) => revealTab(e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              actions.setActiveTab(group.id, t.id);
            } else if (
              (e.key === "Delete" || e.key === "Backspace") &&
              !(e.metaKey || e.ctrlKey || e.altKey || e.shiftKey)
            ) {
              e.preventDefault();
              actions.close(t.id);
            }
          }}
        >
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
              <icon.fold size={13} />
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
              <icon.putBack size={14} aria-hidden />
            </button>
          ) : null}
          <button
            className="jali-tab-close"
            tabIndex={-1}
            aria-label={tw.close(title)}
            onClick={() => actions.close(t.id)}
          >
            <icon.close size={14} aria-hidden />
          </button>
        </span>
      </div>
    );
  };

  return (
    <div className="jali-tabbar">
      <div
        className="jali-tabs"
        ref={strip}
        role="tablist"
        aria-label={tw.listLabel(tabs.length)}
        onScroll={measure}
      >
        {mine.map(renderTab)}
        {folded.length && mine.length ? <span className="jali-tab-sep" aria-hidden /> : null}
        {folded.map(renderTab)}
      </div>
      {overflowing ? (
        <TabOverflow
          tabs={[...mine, ...folded]}
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
          <icon.newTab size={14} aria-hidden />
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
  return role ? <role.icon size={14} aria-hidden /> : <KindIcon kind={node.ref.kind} size={14} />;
}
