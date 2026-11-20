import type { Settings as S, ThemeChoice } from "@jali/core";
import { useRef, type ReactNode } from "react";
import { ModalDialog } from "../a11y/ModalDialog";
import { useJaliIcons } from "../icons/context";

import { useStore, useUi } from "../state/react";
import { PALETTE_ID, commandById, parseKeys } from "@jali/core/adapter";
import { PAGE_PARTS } from "../define";

const THEMES: { id: ThemeChoice; label: "themeSystem" | "themeLight" | "themeDark" }[] = [
  { id: "system", label: "themeSystem" },
  { id: "light", label: "themeLight" },
  { id: "dark", label: "themeDark" },
];

/** Jali's settings. `children` are the host's own fieldsets, shown last. */
export function SettingsPanel({ children }: { children?: ReactNode } = {}) {
  const icon = useJaliIcons();
  const store = useStore();
  const id = store.dom.id;
  const open = useUi((s) => s.settingsOpen);
  const settings = useUi((s) => s.settings);
  // A curated page's own settings, which its parts bring (definePage).
  const PageSettings = store.env.profile?.[PAGE_PARTS]?.Settings;
  const t = store.messages.settings;
  const first = useRef<HTMLInputElement>(null);
  if (!open) return null;
  const set = (patch: Partial<S>) => store.actions.changeSettings(patch);
  const close = () => store.actions.closeSettings();
  return (
    <ModalDialog
      scrim="jali-scrim jali-scrim-light"
      onClose={close}
      initialFocus={first}
      className="jali-dialog jali-settings"
      data-dialog="settings"
      role="dialog"
      aria-labelledby={`${id}-settings-title`}
    >
      <header>
        <h2 id={`${id}-settings-title`}>{t.title}</h2>
        <button className="jali-icon-btn" onClick={close} aria-label={t.close}>
          <icon.close size={14} aria-hidden />
        </button>
      </header>
      <fieldset>
        <legend>{t.theme}</legend>
        {THEMES.map((theme, n) => (
          <label key={theme.id} className="jali-setting">
            <input
              ref={n === 0 ? first : undefined}
              type="radio"
              name={`${id}-theme`}
              checked={settings.theme === theme.id}
              onChange={() => set({ theme: theme.id })}
            />
            <span>{t[theme.label]}</span>
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>{t.centreDrop}</legend>
        <label className="jali-setting">
          <input
            type="radio"
            name={`${id}-centre`}
            checked={settings.centreDrop === "swap"}
            onChange={() => set({ centreDrop: "swap" })}
          />
          <span>{t.centreDropSwap}</span>
        </label>
        <label className="jali-setting">
          <input
            type="radio"
            name={`${id}-centre`}
            checked={settings.centreDrop === "tab"}
            onChange={() => set({ centreDrop: "tab" })}
          />
          <span>{t.centreDropTab}</span>
        </label>
      </fieldset>
      <fieldset>
        <legend>{t.paneCap}</legend>
        <label className="jali-row-field">
          <input
            type="number"
            min={2}
            max={16}
            value={settings.paneCap}
            onChange={(e) =>
              set({ paneCap: Math.max(2, Math.min(16, Number(e.target.value) || 8)) })
            }
          />
          <span>{t.paneCapHelp}</span>
        </label>
      </fieldset>
      {PageSettings ? <PageSettings /> : null}
      <KeyboardList />
      {children}
    </ModalDialog>
  );
}

/**
 * The keys this page answers to, from the store's keymap (so a host's changes show here too), in this platform's
 * words. Keys inside a pane (J/K, Space, Enter) belong to that pane and only work while it has focus.
 */
function KeyboardList() {
  const store = useStore();
  const { keymap } = store;
  const { settings: t, keys } = store.messages;
  const rows = keymap.entries.map(([id, seqs]) => ({
    id,
    title: id === PALETTE_ID ? t.paletteKey : (commandById(store, id)?.title ?? id),
    keys: keys.alternatives(seqs.map((q) => keymap.format(q))),
  }));
  rows.push({
    id: "escape",
    title: t.escapeKey,
    keys: keymap.format([{ key: "Escape" }]),
  });
  return (
    <fieldset>
      <legend>{t.keyboard}</legend>
      <dl className="jali-keys-list" aria-label={t.keyboardLabel}>
        {rows.map((r) => (
          <div key={r.id} className="jali-keys-row" data-command-id={r.id}>
            <dt>{r.title}</dt>
            <dd>
              <kbd>{r.keys}</kbd>
            </dd>
          </div>
        ))}
      </dl>
      <p className="jali-keys-note">{t.keyboardNote(keymap.format(parseKeys("Mod+Z")))}</p>
    </fieldset>
  );
}
