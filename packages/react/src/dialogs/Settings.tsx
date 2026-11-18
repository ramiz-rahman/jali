import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Settings as S, ThemeChoice } from "@jali/core";
import { useStore, useUi } from "../state/react";
import { formatChord, formatKeys } from "@jali/core";
import { PALETTE_ID } from "@jali/core";
import { commandById } from "@jali/core";
import { viewerLabel } from "@jali/core";

const THEMES: { id: ThemeChoice; label: string }[] = [{ id: "system", label: "System" }, { id: "light", label: "Light" }, { id: "dark", label: "Dark" }];

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function SettingsPanel() {
  const store = useStore();
  const open = useUi((s) => s.settingsOpen);
  const settings = useUi((s) => s.settings);
  const review = useUi((s) => s.review);
  const page = store.env.profile;
  const full = viewerLabel(page, true);
  const limited = viewerLabel(page, false);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) first.current?.focus();
  }, [open]);
  if (!open) return null;
  const set = (patch: Partial<S>) => store.set({ settings: { ...store.get().settings, ...patch } });
  const close = () => store.set({ settingsOpen: false });
  return (
    <div className="jali-scrim jali-scrim-light" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div
        className="jali-settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.stopPropagation(); close(); }
        }}
      >
        <header>
          <h2 id="settings-title">Settings</h2>
          <button className="jali-icon-btn" onClick={close} aria-label="Close settings"><X size={14} strokeWidth={1.5} aria-hidden /></button>
        </header>
        <fieldset>
          <legend>Theme</legend>
          {THEMES.map((t, n) => (
            <label key={t.id} className="jali-radio">
              <input ref={n === 0 ? first : undefined} type="radio" name="theme" checked={settings.theme === t.id} onChange={() => set({ theme: t.id })} />
              <span>{t.label}</span>
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Centre drop</legend>
          <label className="jali-radio"><input type="radio" name="centre" checked={settings.centreDrop === "swap"} onChange={() => set({ centreDrop: "swap" })} /><span>Swap the two panes</span></label>
          <label className="jali-radio"><input type="radio" name="centre" checked={settings.centreDrop === "tab"} onChange={() => set({ centreDrop: "tab" })} /><span>Add as a tab</span></label>
        </fieldset>
        <fieldset>
          <legend>Pane cap</legend>
          <label className="jali-row-field">
            <input type="number" min={2} max={16} value={settings.paneCap} onChange={(e) => set({ paneCap: Math.max(2, Math.min(16, Number(e.target.value) || 8)) })} />
            <span>Over the cap, the oldest unpinned, unfocused pane becomes a tab.</span>
          </label>
        </fieldset>
        {page ? <fieldset>
          <legend>{page.name}: opened panes</legend>
          <label className="jali-radio"><input type="radio" name="boundary" checked={settings.boundary === "tint"} onChange={() => set({ boundary: "tint" })} /><span>Tinted header and “Opened” tag</span></label>
          <label className="jali-radio"><input type="radio" name="boundary" checked={settings.boundary === "none"} onChange={() => set({ boundary: "none" })} /><span>No marking</span></label>
        </fieldset> : null}
        {review ? (
          <fieldset>
            <legend>{page?.name}: viewing as</legend>
            <label className="jali-radio"><input type="radio" name="viewer" checked={review.canInvestigate} onChange={() => store.actions.setCanInvestigate(true)} /><span>{cap(full)}: links open beside</span></label>
            <label className="jali-radio"><input type="radio" name="viewer" checked={!review.canInvestigate} onChange={() => store.actions.setCanInvestigate(false)} /><span>{cap(limited)}: Single only, links open as a peek</span></label>
          </fieldset>
        ) : null}
        <KeyboardList />
        <fieldset>
          <legend>Status line</legend>
          <label className="jali-radio"><input type="checkbox" checked={settings.showStats} onChange={(e) => set({ showStats: e.target.checked })} /><span>Show fetch stats</span></label>
        </fieldset>
      </div>
    </div>
  );
}

/**
 * The keys this page answers to, from the store's keymap (so a host's changes show here too), in this platform's
 * words. Keys inside a pane (J/K, Space, Enter) belong to that pane and only work while it has focus.
 */
function KeyboardList() {
  const store = useStore();
  const { keymap } = store;
  const rows = keymap.entries.map(([id, seqs]) => ({
    id,
    title: id === PALETTE_ID ? "Command palette (then a second key for a chord)" : commandById(store, id)?.title ?? id,
    keys: seqs.map((q) => formatKeys(q, keymap.platform)).join(" or "),
  }));
  rows.push({ id: "escape", title: "Close the peek, then leave maximise (after the pane's own use of it)", keys: formatChord({ key: "Escape" }, keymap.platform) });
  return (
    <fieldset>
      <legend>Keyboard</legend>
      <dl className="jali-keys-list" aria-label="Keyboard shortcuts">
        {rows.map((r) => (
          <div key={r.id} className="jali-keys-row" data-command-id={r.id}>
            <dt>{r.title}</dt>
            <dd><kbd>{r.keys}</kbd></dd>
          </div>
        ))}
      </dl>
      <p className="jali-keys-note">Inside a pane, its own keys come first: J/K and the arrows move, Space peeks, {keymap.platform === "mac" ? "⌘Z" : "Ctrl+Z"} undoes the pane's own changes, and the first Esc is the pane's.</p>
    </fieldset>
  );
}
