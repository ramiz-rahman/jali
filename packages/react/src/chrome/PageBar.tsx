/**
 * A curated page's React parts: its view (rail, header, tabs and panes), its bar, the ⌥ preview over the panes and its
 * settings. `definePage` puts them on the page (`pageParts`), so an app without a page ships none of them.
 */
import { useEffect, useMemo, useRef, type ComponentType } from "react";
import type { Settings as S } from "@jali/core";
import { useJaliIcons } from "../icons/context";
import {
  besidePreview,
  investigation,
  roleOf,
  startTabDrag,
  viewerLabel,
} from "@jali/core/adapter";
import { useRovingKeys } from "../a11y/roving";
import { bold, Parts, useGeometry, useModel, useStore, useUi, useProfile } from "../state/react";
import { useKeymap } from "../state/hydrated";
import { Panes } from "../workspace/Workspace";
import { useLandmarkName } from "../a11y/landmark";
import { Guard } from "./Guard";

/**
 * A curated page's controls in the top bar: the mode (Single or Split view), the investigation (panes opened from
 * links) with its way back, and Reset for the split layout. Which views are on screen is the tabs' job.
 */
export function PageBar() {
  const icon = useJaliIcons();
  const page = useUi((s) => s.page);
  const m = useGeometry();
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
          type="button"
          role="radio"
          aria-checked={!multi}
          className="jali-seg-btn"
          onClick={() => actions.setMode("single")}
          title={t.singleTip}
        >
          <icon.singleView size={14} aria-hidden /> {t.single}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={multi}
          className="jali-seg-btn"
          onClick={() => actions.setMode("split")}
          disabled={!page.canInvestigate}
          title={page.canInvestigate ? t.splitTip : t.splitTipLimited}
        >
          <icon.splitView size={14} aria-hidden /> {t.split}
        </button>
      </div>
      {multi && opened ? (
        <div className="jali-inv" role="group" aria-label={t.investigation}>
          <span className="jali-inv-mark" aria-hidden />
          <span className="jali-inv-text">
            <Parts of={t.investigating(opened, bold)} />
          </span>
          <button type="button" className="jali-inv-back" onClick={() => actions.backToPage()}>
            <icon.back size={13} aria-hidden /> {t.backTo(profile.name)}
          </button>
        </div>
      ) : null}
      {multi ? (
        <button
          type="button"
          className="jali-icon-btn jali-page-reset"
          onClick={() => actions.resetPage()}
          aria-label={t.reset}
          title={t.resetTip}
        >
          <icon.reset size={15} aria-hidden />
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
              <Icon size={14} aria-hidden />
              <span>{r.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** The curated page: the queue at the left; the item's header, its tabs and the panes at the right. */
export function CuratedPage() {
  const p = useProfile()!;
  const item = useUi((s) => s.page!.item);
  const { actions } = useStore();
  return (
    <div className="jali-page">
      {p.Rail && (
        <Guard>
          <p.Rail item={item} activate={actions.activate} />
        </Guard>
      )}
      <div className="jali-page-main">
        <Guard>
          <p.Header item={item} />
        </Guard>
        <PageTabs />
        <Panes />
      </div>
    </div>
  );
}

/** ⌥ over a page tab: a dashed outline where ⌥-click would open that view, and a fainter one for each view it moves.
 *  The preview runs the very placement the click commits (besidePreview), so the two cannot differ. */
function Ghost({ role }: { role: string }) {
  const store = useStore();
  const m = useModel();
  const preview = useMemo(() => besidePreview(store.snapshot(), role), [store, role, m]);
  if (!preview) return null;
  const p = store.env.profile!;
  const name = (id: string) => roleOf(p, id)?.label ?? m.title(id);
  const box = (r: { x: number; y: number; width: number; height: number }) => ({
    left: r.x,
    top: r.y,
    width: r.width,
    height: r.height,
  });

  return (
    <>
      {preview.moved.map((v) => (
        <div
          key={v.id}
          className="jali-ghost jali-ghost-moved"
          data-ghost={v.id}
          style={box(v.rect)}
          aria-hidden
        />
      ))}
      <div className="jali-ghost" data-ghost={role} style={box(preview.incoming)} aria-hidden>
        <span>{store.messages.page.ghost(name(role), preview.leaving.map(name))}</span>
      </div>
    </>
  );
}

/** The page's fieldsets in Settings: how opened panes are marked, and the viewer the page is seen as. */
function PageSettings() {
  const store = useStore();
  const id = store.dom.id;
  const settings = useUi((s) => s.settings);
  const page = useUi((s) => s.page);
  const profile = store.env.profile!;
  const t = store.messages.settings;
  const full = viewerLabel(profile, true, store.messages.page);
  const limited = viewerLabel(profile, false, store.messages.page);
  const set = (patch: Partial<S>) => store.actions.changeSettings(patch);
  return (
    <>
      <fieldset>
        <legend>{t.openedPanes(profile.name)}</legend>
        <label className="jali-setting">
          <input
            type="radio"
            name={`${id}-boundary`}
            checked={settings.boundary === "tint"}
            onChange={() => set({ boundary: "tint" })}
          />
          <span>{t.boundaryTint}</span>
        </label>
        <label className="jali-setting">
          <input
            type="radio"
            name={`${id}-boundary`}
            checked={settings.boundary === "none"}
            onChange={() => set({ boundary: "none" })}
          />
          <span>{t.boundaryNone}</span>
        </label>
      </fieldset>
      {page ? (
        <fieldset>
          <legend>{t.viewingAs(profile.name)}</legend>
          <label className="jali-setting">
            <input
              type="radio"
              name={`${id}-viewer`}
              checked={page.canInvestigate}
              onChange={() => store.actions.setCanInvestigate(true)}
            />
            <span>{t.viewerFull(full)}</span>
          </label>
          <label className="jali-setting">
            <input
              type="radio"
              name={`${id}-viewer`}
              checked={!page.canInvestigate}
              onChange={() => store.actions.setCanInvestigate(false)}
            />
            <span>{t.viewerLimited(limited)}</span>
          </label>
        </fieldset>
      ) : null}
    </>
  );
}

/** What a curated page renders, by part: put on the page by `definePage`, read by `<JaliView>`, `<Panes>` and
 *  `<SettingsPanel>`. */
export interface PageParts {
  View: ComponentType;
  Ghost: ComponentType<{ role: string }>;
  Settings: ComponentType;
}

export const pageParts: PageParts = { View: CuratedPage, Ghost, Settings: PageSettings };
