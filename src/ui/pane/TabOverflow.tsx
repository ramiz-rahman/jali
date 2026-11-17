import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, FoldHorizontal, Undo2 } from "lucide-react";
import type { NodeId } from "../../layout-core/types";
import { getProfile, roleOf, titleOf } from "../profile";
import { useUi } from "../state/react";
import type { Tab } from "../workspace/frames";
import { KindIcon } from "./icons";
import { FOLDED_DESC, FOLDED_WORD, TUCKED_DESC } from "./tabState";

/** The "+N" at the end of a tab strip that overflows: opens a menu of every tab in the group, marks included. */
export function TabOverflow({ tabs, active, hiddenCount, onChoose }: { tabs: Tab[]; active: NodeId; hiddenCount: number; onChoose: (id: NodeId) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const review = useUi((s) => !!s.review);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const w = 280;
    setPos({ left: Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)), top: r.bottom + 4 });
  }, [open]);
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
    const go = (n: number) => { e.preventDefault(); items[(n + items.length) % items.length]?.focus(); };
    let used = true;
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Escape") { e.preventDefault(); close(true); }
    else if (e.key === "Tab") { setOpen(false); }
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      (document.activeElement as HTMLElement | null)?.click();
    } else used = false;
    if (used) e.nativeEvent.stopImmediatePropagation();
  };
  const choose = (id: NodeId) => {
    setOpen(false);
    onChoose(id);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[role="tab"][data-tab="${id}"]`)?.focus({ preventScroll: true }));
  };

  return (
    <>
      <button
        ref={btn}
        className="tab-more"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`All ${tabs.length} tabs${hiddenCount ? `, ${hiddenCount} out of view` : ""}`}
        title="All tabs"
        data-hidden-count={hiddenCount}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        onKeyDown={(e) => { if (e.key === "ArrowDown" && !open) { e.preventDefault(); e.nativeEvent.stopImmediatePropagation(); setOpen(true); } }}
      >
        <span className="tab-more-n">+{hiddenCount}</span>
        <ChevronDown size={12} strokeWidth={1.75} aria-hidden />
      </button>
      {open ? createPortal(
        <div ref={menu} className="tab-menu" role="menu" aria-label="Tabs in this group" style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden" }} onKeyDown={onKey}>
          {tabs.map(({ node: t, tucked, folded }) => {
            const role = review && t.role ? roleOf(getProfile()!, t.role) : undefined;
            return (
              <button
                key={t.id}
                role="menuitem"
                className={`tab-menu-item${t.id === active ? " is-active" : ""}`}
                data-item={t.id}
                data-folded={folded || undefined}
                data-tucked={tucked || undefined}
                aria-current={t.id === active || undefined}
                aria-description={folded ? FOLDED_DESC : tucked ? TUCKED_DESC : undefined}
                tabIndex={-1}
                onClick={() => choose(t.id)}
              >
                <span className="tab-menu-check" aria-hidden>{t.id === active ? <Check size={13} strokeWidth={2} /> : null}</span>
                {role ? <role.icon size={14} strokeWidth={1.5} aria-hidden /> : <KindIcon kind={t.ref.kind} size={14} />}
                <span className="tab-menu-title">{titleOf(t)}</span>
                {folded ? <small className="tab-menu-mark"><FoldHorizontal size={12} strokeWidth={1.75} aria-hidden />{FOLDED_WORD}</small> : null}
                {tucked ? <small className="tab-menu-mark"><Undo2 size={12} strokeWidth={1.75} aria-hidden />Tucked</small> : null}
              </button>
            );
          })}
        </div>,
        document.body,
      ) : null}
    </>
  );
}
