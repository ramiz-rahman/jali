import { own } from "@jali/core/adapter";
import type { NodeId } from "@jali/core";
import { useCallback, useRef, useState } from "react";
import { useJaliIcons } from "../icons/context";
import { Menu } from "../a11y/Menu";
import type { Tab } from "@jali/core/adapter";
import { cssString, mostPressing, roleOf, titleOf } from "@jali/core/adapter";
import { useEntriesOf, useStore, useUi } from "../state/react";
import { KindIcon } from "./icons";
import { Activity, shelfActivity } from "./Activity";
import { ICON } from "../icons/sized";

/**
 * The "+N" at the end of a tab strip that overflows: opens a menu of every tab in the group, marks included. With
 * `folded`, the "N folded" chip instead: the panes the layout folded into this place, which it doesn't show as tabs,
 * with a note saying why; picking one shows it here.
 */
export function TabOverflow({
  tabs,
  active,
  hiddenCount = 0,
  folded = false,
  onChoose,
}: {
  tabs: Tab[];
  active: NodeId;
  hiddenCount?: number;
  folded?: boolean;
  onChoose: (id: NodeId) => void;
}) {
  const store = useStore(),
    env = store.env,
    words = store.messages,
    tw = words.tabs;
  // The folded chip lists only folded panes: no need to mark each one.
  const chip = folded;
  const icon = useJaliIcons();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const page = useUi((s) => !!s.page);
  // Its own panes' live titles, data-* attributes and activity: it renders again when one of those changes, and for no
  // other pane's.
  const ids = tabs.map((t) => t.node.id);
  const titles = useEntriesOf((s) => s.titles, ids);
  const marks = useEntriesOf((s) => s.paneAttributes, ids);
  const activity = useEntriesOf((s) => s.activity, ids);
  // A folded pane goes on working behind the chip: the chip says so, with the most pressing of its panes' activities.
  const behind = folded ? mostPressing(tabs.map(({ node }) => own(activity, node.id))) : undefined;
  const dir = useUi((s) => s.dir);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  }, []);
  // Under the button, lined up with its end side: its right edge, or its left edge right to left.
  const at = () => {
    const r = btn.current!.getBoundingClientRect();
    return { x: dir === "rtl" ? r.left : r.right, y: r.bottom + 4, end: true };
  };
  const choose = (id: NodeId) => {
    setOpen(false);
    onChoose(id);
    requestAnimationFrame(() =>
      store.dom
        .root()
        .querySelector<HTMLElement>(`[role="tab"][data-tab=${cssString(id)}]`)
        ?.focus({ preventScroll: true }),
    );
  };

  return (
    <>
      <button
        type="button"
        ref={btn}
        className={folded ? "jali-tab-folded" : "jali-tab-more"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          folded ? tw.foldedChipLabel(tabs.length, behind) : tw.all(tabs.length, hiddenCount)
        }
        aria-description={folded ? tw.foldedDescription : undefined}
        title={folded ? tw.foldedChipTip : tw.allTip}
        data-hidden-count={folded ? undefined : hiddenCount}
        data-activity={shelfActivity(behind)?.state}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            e.nativeEvent.stopImmediatePropagation();
            setOpen(true);
          }
        }}
      >
        {folded ? (
          <>
            <icon.fold {...ICON.tabSmall} aria-hidden />
            <span className="jali-tab-folded-words">{tw.foldedChip(tabs.length)}</span>
            {/* A narrow header shows the count alone (styles/tabs.css); the chip's name still says it in full. */}
            <span className="jali-tab-folded-count" aria-hidden>
              {tabs.length}
            </span>
            <Activity activity={behind} shape />
          </>
        ) : (
          <>
            <span className="tab-more-n">{tw.moreCount(hiddenCount)}</span>
            <icon.more {...ICON.tabSmall} aria-hidden />
          </>
        )}
      </button>
      {open ? (
        <Menu
          at={at()}
          onClose={close}
          trigger={btn}
          initial={(items) => items.find((el) => el.dataset.item === active)}
          className={folded ? "jali-tab-menu jali-tab-menu-folded" : "jali-tab-menu"}
          aria-label={folded ? words.shelf.menuFolded : tw.menuLabel}
          aria-description={folded ? tw.foldedNote : undefined}
        >
          {/* Folded: a quiet heading naming what these are, the panes, then a foot saying nothing needs doing. The
              description above says the same for assistive technology, so these are hidden from it. Divs, not
              paragraphs: an app's own paragraph styles (a reset, a prose margin) never reach Jali's menu. */}
          {folded ? (
            <div className="jali-tab-menu-heading" aria-hidden>
              {tw.foldedHeading}
            </div>
          ) : null}
          {tabs.map(({ node: t, tucked, folded: isFolded }) => {
            const folded = isFolded;
            const role = page && t.role ? roleOf(env.profile!, t.role) : undefined;
            return (
              <button
                type="button"
                {...own(marks, t.id)}
                key={t.id}
                role="menuitem"
                className={`jali-tab-menu-item${t.id === active ? " is-active" : ""}`}
                data-item={t.id}
                data-folded={(folded && !chip) || undefined}
                data-tucked={tucked || undefined}
                aria-current={t.id === active || undefined}
                aria-description={
                  folded ? tw.foldedDescription : tucked ? tw.tuckedDescription : undefined
                }
                tabIndex={-1}
                onClick={() => choose(t.id)}
              >
                {/* The folded menu lists only panes not shown: no mark, so no column for one. */}
                {chip ? null : (
                  <span className="jali-tab-menu-check" aria-hidden>
                    {t.id === active ? <icon.current {...ICON.menuMark} /> : null}
                  </span>
                )}
                {role ? (
                  <role.icon {...ICON.menu} aria-hidden />
                ) : (
                  <KindIcon kind={t.ref.kind} {...ICON.menu} />
                )}
                <span className="jali-tab-menu-title">{titleOf(env, t, titles)}</span>
                <Activity activity={own(activity, t.id)} />
                {folded && !chip ? (
                  <small className="jali-tab-menu-mark">
                    <icon.fold {...ICON.menuSmall} aria-hidden />
                    {tw.folded}
                  </small>
                ) : null}
                {tucked ? (
                  <small className="jali-tab-menu-mark">
                    <icon.putBack {...ICON.menuSmall} aria-hidden />
                    {tw.tucked}
                  </small>
                ) : null}
                {chip ? (
                  <span className="jali-tab-menu-hint" aria-hidden>
                    {tw.foldedShow}
                  </span>
                ) : null}
              </button>
            );
          })}
          {folded ? (
            <div className="jali-tab-menu-foot" aria-hidden>
              <icon.fold {...ICON.menuSmall} aria-hidden />
              <span>{tw.foldedFoot}</span>
            </div>
          ) : null}
        </Menu>
      ) : null}
    </>
  );
}
