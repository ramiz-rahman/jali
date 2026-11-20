import type { NodeId } from "@jali/core";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useJaliIcons } from "../icons/context";
import { createPortal } from "react-dom";
import type { Tab } from "@jali/core/adapter";
import { roleOf, titleOf } from "@jali/core/adapter";
import { useStore } from "../state/react";
import { useUi } from "../state/react";
import { KindIcon } from "./icons";
import { Activity, shelfActivity } from "./Activity";
import type { PaneActivity } from "@jali/core";

/** Most pressing first: what the folded chip shows for the panes behind it. */
const URGENCY: PaneActivity[] = ["error", "needs-you", "working", "loading"];
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
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const page = useUi((s) => !!s.page);
  const titles = useUi((s) => s.titles);
  const marks = useUi((s) => s.paneAttributes);
  const activity = useUi((s) => s.activity);
  // A folded pane goes on working behind the chip: the chip says so, with the most pressing of its panes' activities.
  const behind = folded ? mostPressing(tabs.map(({ node }) => activity[node.id])) : undefined;
  const dir = useUi((s) => s.dir);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const w = 280;
    // Under the button, lined up with its end side: its right edge, or its left edge right to left.
    const left = dir === "rtl" ? r.left : r.right - w;
    setPos({
      left: Math.max(8, Math.min(left, window.innerWidth - w - 8)),
      top: r.bottom + 4,
    });
  }, [open, dir]);
  useEffect(() => {
    if (!open || !pos) return;
    const items = menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    const cur = [...(items ?? [])].find((el) => el.dataset.item === active) ?? items?.[0];
    cur?.focus();
  }, [open, pos, active]);
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", off, true);
    return () => document.removeEventListener("pointerdown", off, true);
  }, [open]);

  const onKey = (e: KeyboardEvent) => {
    // Keys here belong to the menu: nothing else in the app may act on them.
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => {
      e.preventDefault();
      items[(n + items.length) % items.length]?.focus();
    };
    let used = true;
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      (document.activeElement as HTMLElement | null)?.click();
    } else used = false;
    if (used) e.nativeEvent.stopImmediatePropagation();
  };
  const choose = (id: NodeId) => {
    setOpen(false);
    onChoose(id);
    requestAnimationFrame(() =>
      store.dom
        .root()
        .querySelector<HTMLElement>(`[role="tab"][data-tab="${id}"]`)
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
            <icon.fold size={12} aria-hidden />
            <span>{tw.foldedChip(tabs.length)}</span>
            <Activity a={behind} shape />
          </>
        ) : (
          <>
            <span className="tab-more-n">{tw.moreCount(hiddenCount)}</span>
            <icon.more size={12} aria-hidden />
          </>
        )}
      </button>
      {open
        ? createPortal(
            <div
              ref={menu}
              className="jali-tab-menu"
              role="menu"
              dir={dir}
              aria-label={folded ? words.shelf.menuFolded : tw.menuLabel}
              aria-description={folded ? tw.foldedNote : undefined}
              style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden" }}
              onKeyDown={onKey}
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
                    {...marks[t.id]}
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
                      {t.id === active ? <icon.current size={13} /> : null}
                    </span>
                    {role ? (
                      <role.icon size={14} aria-hidden />
                    ) : (
                      <KindIcon kind={t.ref.kind} size={14} />
                    )}
                    <span className="jali-tab-menu-title">{titleOf(env, t, titles)}</span>
                    <Activity a={activity[t.id]} />
                    {folded && !chip ? (
                      <small className="jali-tab-menu-mark">
                        <icon.fold size={12} aria-hidden />
                        {tw.folded}
                      </small>
                    ) : null}
                    {tucked ? (
                      <small className="jali-tab-menu-mark">
                        <icon.putBack size={12} aria-hidden />
                        {tw.tucked}
                      </small>
                    ) : null}
                  </button>
                );
              })}
            </div>,
            store.dom.layer() ?? document.body,
          )
        : null}
    </>
  );
}
