import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { getState, setState, useUi, type Settings as S, type ThemeChoice } from "./store";
import { ADAPTERS } from "./dividers/DividerLayer";

const mq = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null);
/** The theme actually showing: the choice, or the system preference when the choice is "system". */
export function useResolvedTheme(): "light" | "dark" {
  const choice = useUi((s) => s.settings.theme);
  const systemDark = useSyncExternalStore(
    (cb) => { const m = mq(); m?.addEventListener("change", cb); return () => m?.removeEventListener("change", cb); },
    () => !!mq()?.matches,
  );
  return choice === "system" ? (systemDark ? "dark" : "light") : choice;
}
const THEMES: { id: ThemeChoice; label: string }[] = [{ id: "system", label: "System" }, { id: "light", label: "Light" }, { id: "dark", label: "Dark" }];

export function SettingsPanel() {
  const open = useUi((s) => s.settingsOpen);
  const settings = useUi((s) => s.settings);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) first.current?.focus();
  }, [open]);
  if (!open) return null;
  const set = (patch: Partial<S>) => setState({ settings: { ...getState().settings, ...patch } });
  const close = () => setState({ settingsOpen: false });
  return (
    <div className="scrim scrim-light" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div
        className="settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.stopPropagation(); close(); }
        }}
      >
        <header>
          <h2 id="settings-title">Settings</h2>
          <button className="icon-btn" onClick={close} aria-label="Close settings"><X size={14} strokeWidth={1.5} aria-hidden /></button>
        </header>
        <fieldset>
          <legend>Theme</legend>
          {THEMES.map((t) => (
            <label key={t.id} className="radio">
              <input type="radio" name="theme" checked={settings.theme === t.id} onChange={() => set({ theme: t.id })} />
              <span>{t.label}</span>
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Resize adapter</legend>
          {(["own", "ark"] as const).map((id, n) => (
            <label key={id} className="radio">
              <input ref={n === 0 ? first : undefined} type="radio" name="adapter" checked={settings.adapter === id} onChange={() => set({ adapter: id })} />
              <span>{ADAPTERS[id].label}</span>
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Centre drop</legend>
          <label className="radio"><input type="radio" name="centre" checked={settings.centreDrop === "swap"} onChange={() => set({ centreDrop: "swap" })} /><span>Swap the two panes</span></label>
          <label className="radio"><input type="radio" name="centre" checked={settings.centreDrop === "tab"} onChange={() => set({ centreDrop: "tab" })} /><span>Add as a tab</span></label>
        </fieldset>
        <fieldset>
          <legend>Pane cap</legend>
          <label className="row-field">
            <input type="number" min={2} max={16} value={settings.paneCap} onChange={(e) => set({ paneCap: Math.max(2, Math.min(16, Number(e.target.value) || 8)) })} />
            <span>Over the cap, the oldest unpinned, unfocused pane becomes a tab.</span>
          </label>
        </fieldset>
        <fieldset>
          <legend>Status line</legend>
          <label className="radio"><input type="checkbox" checked={settings.showStats} onChange={(e) => set({ showStats: e.target.checked })} /><span>Show fetch stats</span></label>
        </fieldset>
      </div>
    </div>
  );
}
