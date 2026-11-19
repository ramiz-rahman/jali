import { useEffect, useRef, type KeyboardEvent } from "react";
import { Columns2, RotateCcw, Square, Undo2 } from "lucide-react";
import { investigation, startTabDrag } from "@jali/core/adapter";
import { bold, Parts, useModel, useStore, useUi, useProfile } from "../state/react";
import { Panes } from "../workspace/Workspace";

/**
 * A curated page's controls in the top bar: the mode (Single or Split view), the investigation (panes opened from
 * links) with its way back, and Reset for the split layout. Which views are on screen is the tabs' job.
 */
export function PageBar() {
  const page = useUi((s) => s.page);
  const m = useModel();
  const { actions, messages } = useStore();
  const t = messages.page;
  const profile = useProfile();
  if (!profile || !page) return null;
  const opened = investigation(m.panes).length;
  const multi = page.mode === "split";
  return (
    <div className="jali-page-bar">
      <div className="jali-seg jali-mode-switch" role="radiogroup" aria-label={t.viewMode}>
        <button
          role="radio"
          aria-checked={!multi}
          className="jali-seg-btn"
          onClick={() => actions.setMode("single")}
          title={t.singleTip}
        >
          <Square size={14} strokeWidth={1.5} aria-hidden /> {t.single}
        </button>
        <button
          role="radio"
          aria-checked={multi}
          className="jali-seg-btn"
          onClick={() => actions.setMode("split")}
          disabled={!page.canInvestigate}
          title={page.canInvestigate ? t.splitTip : t.splitTipLimited}
        >
          <Columns2 size={14} strokeWidth={1.5} aria-hidden /> {t.split}
        </button>
      </div>
      {multi && opened ? (
        <div className="jali-inv" role="group" aria-label={t.investigation}>
          <span className="jali-inv-mark" aria-hidden />
          <span className="jali-inv-text">
            <Parts of={t.investigating(opened, bold)} />
          </span>
          <button className="jali-inv-back" onClick={() => actions.backToPage()}>
            <Undo2 size={13} strokeWidth={1.75} aria-hidden /> {t.backTo(profile.name)}
          </button>
        </div>
      ) : null}
      {multi ? (
        <button
          className="jali-icon-btn jali-page-reset"
          onClick={() => actions.resetPage()}
          aria-label={t.reset}
          title={t.resetTip}
        >
          <RotateCcw size={15} strokeWidth={1.5} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/**
 * The page's tabs. Single: one is selected, the view on screen. Split view: the tabs are a palette of views; each is
 * marked focused, on screen or not, and dragging one into the panes places it there. ⌥-click opens a view beside.
 */
function PageTabs() {
  const p = useProfile()!;
  const store = useStore();
  const { actions } = store;
  const t = store.messages.page;
  const altClick = store.messages.keys.altClick(store.keymap.platform);
  const page = useUi((s) => s.page)!;
  const focused = useUi((s) => s.view.focused);
  const m = useModel();
  const strip = useRef<HTMLDivElement>(null);
  // The drag a pointer-down started: a click that ends a drag is not a click.
  const drag = useRef<{ dragged(): boolean } | null>(null);
  // ⌥ over a tab previews where ⌥-click would open it beside (the workspace draws it).
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
  });
  const multi = page.mode === "split";
  const state = (id: string) => {
    if (!multi) return id === page.tab ? "focused" : "off";
    if (m.pane(focused)?.role === id) return "focused";
    return m.visible.includes(id) ? "shown" : m.off.includes(id) ? "off" : "behind";
  };
  const selected = multi ? (m.pane(focused)?.role ?? page.tab) : page.tab;
  const keys = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const tabs = [...(strip.current?.querySelectorAll<HTMLElement>("[role=tab]") ?? [])];
    const i = tabs.indexOf(document.activeElement as HTMLElement);
    tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length]?.focus();
    e.preventDefault();
  };
  return (
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
            key={r.id}
            role="tab"
            className="jali-page-tab"
            data-role={r.id}
            data-state={st}
            aria-selected={r.id === selected}
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
                actions.openTabBeside(r.id);
              } else actions.openTab(r.id);
            }}
          >
            <Icon size={14} strokeWidth={1.5} aria-hidden />
            <span>{r.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The curated page: the queue at the left; the item's header, its tabs and the panes at the right. */
export function CuratedPage() {
  const p = useProfile()!;
  const item = useUi((s) => s.page!.item);
  const { actions } = useStore();
  return (
    <div className="jali-page">
      <p.Rail item={item} activate={actions.activate} />
      <div className="jali-page-main">
        <p.Header item={item} />
        <PageTabs />
        <Panes />
      </div>
    </div>
  );
}
