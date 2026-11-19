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

/** Saved settings over the defaults (Jali's, with the app's `defaults` over them: `createJali({ settings })`). Keys
 *  from older builds (the divider adapter, the lab's showStats) are dropped. */
export function loadSettings(storage: StoragePort, defaults: Partial<Settings> = {}): Settings {
  const base = { ...DEFAULT_SETTINGS, ...defaults };
  try {
    const saved = JSON.parse(storage.get(KEY) ?? "{}") as Partial<Settings> & {
      adapter?: unknown;
      showStats?: unknown;
    };
    const { adapter: _dropped, showStats: _lab, ...known } = saved;
    const s: Settings = { ...base, ...known };
    return valid(s);
  } catch {
    return valid(base);
  }
}

/** `s` with a theme or boundary Jali doesn't know put back to the default. */
function valid(s: Settings): Settings {
  const out = { ...s };
  if (out.theme !== "light" && out.theme !== "dark") out.theme = "system";
  if (out.boundary !== "none") out.boundary = "tint";
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
