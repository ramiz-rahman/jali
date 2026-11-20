import { own } from "@jali/core/adapter";
import type { NodeId } from "@jali/core";
import { useCallback, useRef, useState } from "react";
import { useJaliIcons } from "../icons/context";
import { Menu } from "../a11y/Menu";
import type { Tab } from "@jali/core/adapter";
import { cssString, roleOf, titleOf } from "@jali/core/adapter";
import { useStore } from "../state/react";
import { useUi } from "../state/react";
import { KindIcon } from "./icons";
import { Activity, shelfActivity } from "./Activity";
import type { PaneActivity } from "@jali/core";
import { ICON } from "../icons/sized";

/** Most pressing first: what the folded chip shows for the panes behind it. Live work is healthy and meant to go on,
 *  so it is the least pressing: a pane that is working or waiting for the person says so first. */
const URGENCY: PaneActivity[] = ["error", "needs-you", "working", "loading", "live"];
const mostPressing = (all: (PaneActivity | undefined)[]) => URGENCY.find((a) => all.includes(a));

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
  const titles = useUi((s) => s.titles);
  const marks = useUi((s) => s.paneAttributes);
  const activity = useUi((s) => s.activity);
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
            <span>{tw.foldedChip(tabs.length)}</span>
            <Activity a={behind} shape />
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
          className="jali-tab-menu"
          aria-label={folded ? words.shelf.menuFolded : tw.menuLabel}
          aria-description={folded ? tw.foldedNote : undefined}
        >
          {folded ? (
            <p className="jali-tab-menu-note" aria-hidden>
              {tw.foldedNote}
            </p>
          ) : null}
          {tabs.map(({ node: t, tucked, folded: isFolded }) => {
            const folded = isFolded;
            const role = page && t.role ? roleOf(env.profile!, t.role) : undefined;
            return (
              <button
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
                <span className="jali-tab-menu-check" aria-hidden>
                  {t.id === active ? <icon.current {...ICON.menuMark} /> : null}
                </span>
                {role ? (
                  <role.icon {...ICON.menu} aria-hidden />
                ) : (
                  <KindIcon kind={t.ref.kind} {...ICON.menu} />
                )}
                <span className="jali-tab-menu-title">{titleOf(env, t, titles)}</span>
                <Activity a={own(activity, t.id)} />
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
              </button>
            );
          })}
        </Menu>
      ) : null}
    </>
  );
}
