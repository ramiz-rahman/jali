import { useEffect, useRef } from "react";
import { paneDomId, startTabDrag } from "@jali/core/adapter";
import { useRovingKeys } from "../a11y/roving";
import { useLandmarkName } from "../a11y/landmark";
import { useGeometry, useProfile, useStore, useUi } from "../state/react";
import { useKeymap } from "../state/hydrated";
import { revealInList } from "../chrome/SwitcherItem";

/**
 * The page's tabs. Single: one is selected, the view on screen. Split view: the tabs are a palette of views; each is
 * marked focused, on screen or not, and dragging one into the panes places it there. ⌥-click opens a view beside.
 */
export function PageTabs() {
  const p = useProfile()!;
  const store = useStore();
  const landmarkName = useLandmarkName();
  const { actions } = store;
  const t = store.messages.page;
  const keymap = useKeymap();
  const altClick = store.messages.keys.altClick(keymap.platform);
  const page = useUi((s) => s.page)!;
  const focused = useUi((s) => s.view.focused);
  const m = useGeometry();
  const strip = useRef<HTMLDivElement>(null);
  // The drag a pointer-down started: a click that ends a drag is not a click.
  const drag = useRef<{ dragged(): boolean } | null>(null);
  // ⌥ over a tab previews where ⌥-click would open it beside (the instance draws it).
  const hovered = useRef<string | null>(null);
  const ghost = (alt: boolean) => {
    const g = alt ? hovered.current : null;
    if (store.get().ghost !== g) store.set({ ghost: g });
  };
  useEffect(() => {
    // Alt on its own only previews (it never takes the key); a chord with Alt in it is someone else's.
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Alt" && !e.repeat && !e.metaKey && !e.ctrlKey) ghost(e.type === "keydown");
    };
    const blur = () => ghost(false);
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", key);
      window.removeEventListener("blur", blur);
    };
    // Once per instance: `ghost` reads only the store and a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);
  const multi = page.mode === "split";
  const state = (id: string) => {
    if (!multi) return id === page.tab ? "focused" : "off";
    if (m.pane(focused)?.role === id) return "focused";
    return m.visible.includes(id) ? "shown" : m.off.includes(id) ? "off" : "behind";
  };
  const selected = multi ? (m.pane(focused)?.role ?? page.tab) : page.tab;
  // The view a tab shows, while one is on the page.
  const paneOf = (role: string) => {
    const id = m.panes.find((n) => n.role === role)?.id;
    return id && !m.off.includes(role) ? paneDomId(store.dom.id, id) : undefined;
  };
  const keys = useRovingKeys(() => [
    ...(strip.current?.querySelectorAll<HTMLElement>("[role=tab]") ?? []),
  ]);
  // A landmark of its own, so a screen-reader user who moves by landmarks reaches the views.
  return (
    <nav className="jali-page-nav" aria-label={landmarkName(t.tabsLabel(p.name))}>
      <div
        className="jali-page-tabs"
        role="tablist"
        aria-label={t.tabsLabel(p.name)}
        ref={strip}
        onKeyDown={keys}
      >
        {p.roles.map((r) => {
          const st = state(r.id);
          const Icon = r.icon;
          return (
            <button
              type="button"
              key={r.id}
              role="tab"
              className="jali-page-tab"
              data-role={r.id}
              data-state={st}
              onFocus={(e) => revealInList(e.currentTarget)}
              aria-selected={r.id === selected}
              aria-controls={paneOf(r.id)}
              tabIndex={r.id === selected ? 0 : -1}
              aria-description={
                multi
                  ? st === "off"
                    ? t.tabOff
                    : st === "behind"
                      ? t.tabBehind
                      : t.tabOn
                  : undefined
              }
              title={
                multi
                  ? st === "off"
                    ? t.tabTipOff(r.label, altClick)
                    : t.tabTipFocus(r.label)
                  : t.tabTipSingle(r.label, altClick)
              }
              onPointerDown={(e) => {
                drag.current = startTabDrag(store, e, r.id, r.label);
              }}
              onPointerEnter={(e) => {
                hovered.current = r.id;
                ghost(e.altKey);
              }}
              onPointerLeave={() => {
                hovered.current = null;
                ghost(false);
              }}
              onClick={(e) => {
                if (drag.current?.dragged()) return;
                if (e.altKey) {
                  store.set({ ghost: null });
                  actions.showViewBeside(r.id);
                } else store.run("page.showView", r.id);
              }}
            >
              <Icon size={14} aria-hidden />
              <span>{r.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
