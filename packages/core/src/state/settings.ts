import type { StoragePort } from "../ports";
/** Settings: defaults, persistence, and the theme (one mechanism: `data-theme` on <html> is always the resolved theme). */

export type ThemeChoice = "system" | "light" | "dark";
export type Theme = "light" | "dark";

export interface Settings {
  centreDrop: "swap" | "tab";
  paneCap: number;
  showStats: boolean;
  theme: ThemeChoice;
  /** How a curated workspace marks the panes opened while investigating. */
  boundary: "tint" | "none";
}

export const DEFAULT_SETTINGS: Settings = {
  centreDrop: "swap",
  paneCap: 8,
  showStats: true,
  theme: "system",
  boundary: "tint",
};
const KEY = "settings";

/** Saved settings over the defaults. Keys from older builds (the divider adapter) are dropped. */
export function loadSettings(storage: StoragePort): Settings {
  try {
    const saved = JSON.parse(storage.get(KEY) ?? "{}") as Partial<Settings> & { adapter?: unknown };
    const { adapter: _dropped, ...known } = saved;
    const s: Settings = { ...DEFAULT_SETTINGS, ...known };
    if (s.theme !== "light" && s.theme !== "dark") s.theme = "system";
    if (s.boundary !== "none") s.boundary = "tint";
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
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
