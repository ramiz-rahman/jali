import type { StoragePort } from "../ports";
/** Settings: defaults, persistence, and the theme (one mechanism: `data-theme` on <html> is always the resolved theme). */

export type ThemeChoice = "system" | "light" | "dark";
export type Theme = "light" | "dark";

export interface Settings {
  centreDrop: "swap" | "tab";
  paneCap: number;
  theme: ThemeChoice;
  /** How a curated workspace marks the panes opened while investigating. */
  boundary: "tint" | "none";
}

export const DEFAULT_SETTINGS: Settings = {
  centreDrop: "swap",
  paneCap: 8,
  theme: "system",
  boundary: "tint",
};
const KEY = "settings";

/** The most panes on screen a person can ask for. The settings dialog offers 2 to 16; an app's default or a saved
 *  value may go to this. */
export const PANE_CAP_MAX = 64;

/** What each setting may hold. Anything else, from storage or a call, is not used. */
const CHECKS: { [K in keyof Settings]: (v: unknown) => boolean } = {
  centreDrop: (v) => v === "swap" || v === "tab",
  paneCap: (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= PANE_CAP_MAX,
  theme: (v) => v === "system" || v === "light" || v === "dark",
  boundary: (v) => v === "tint" || v === "none",
};
const KEYS = /* @__PURE__ */ Object.keys(CHECKS) as (keyof Settings)[];

/** Each field of `value` that the setting can take, over `base`; a field it can't take keeps `base`'s. */
function checked(base: Settings, value: unknown): Settings {
  const out = { ...base };
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const k of KEYS) {
    const v = Object.hasOwn(value, k) ? (value as Record<string, unknown>)[k] : undefined;
    if (CHECKS[k](v)) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

/**
 * Saved settings over the defaults (Jali's, with the app's `defaults` over them: `createJali({ settings })`). Each
 * field is checked on its own: a saved value the setting can't take (`paneCap: "8"`, `0`, `1e9`) falls back to the
 * default for that field alone, and the others are kept. Keys that aren't settings (the divider adapter and the
 * example apps' showStats from older builds) are dropped.
 */
export function loadSettings(storage: StoragePort, defaults: Partial<Settings> = {}): Settings {
  const base = checked(DEFAULT_SETTINGS, defaults);
  try {
    return checked(base, JSON.parse(storage.get(KEY) ?? "{}"));
  } catch {
    return base;
  }
}

/** `settings` with `patch` over them, or undefined when `patch` holds a value its setting can't take. Keys that aren't
 *  settings are left out. */
export function settingsWith(settings: Settings, patch: Partial<Settings>): Settings | undefined {
  if (!patch || typeof patch !== "object") return undefined;
  const out = { ...settings };
  for (const k of KEYS) {
    if (!Object.hasOwn(patch, k)) continue;
    const v = (patch as Record<string, unknown>)[k];
    if (!CHECKS[k](v)) return undefined;
    (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export function saveSettings(storage: StoragePort, s: Settings) {
  storage.set(KEY, JSON.stringify(s));
}

export const resolveTheme = (choice: ThemeChoice, systemDark: boolean): Theme =>
  choice === "system" ? (systemDark ? "dark" : "light") : choice;

export function applyTheme(theme: Theme) {
  if (typeof document !== "undefined") document.documentElement.setAttribute("data-theme", theme);
}

const darkQuery = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;
export const systemPrefersDark = () => !!darkQuery()?.matches;

/** Calls back with the system preference whenever it changes. */
export function watchSystemTheme(cb: (dark: boolean) => void): () => void {
  const q = darkQuery();
  const on = () => cb(!!q?.matches);
  q?.addEventListener("change", on);
  return () => q?.removeEventListener("change", on);
}
