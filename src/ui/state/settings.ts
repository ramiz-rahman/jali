/** Settings: defaults, persistence, and the theme (one mechanism: `data-theme` on <html> is always the resolved theme). */

export type ThemeChoice = "system" | "light" | "dark";
export type Theme = "light" | "dark";

export interface Settings {
  centreDrop: "swap" | "tab";
  paneCap: number;
  showStats: boolean;
  theme: ThemeChoice;
}

export const DEFAULT_SETTINGS: Settings = { centreDrop: "swap", paneCap: 8, showStats: true, theme: "system" };
const KEY = "pane-lab:settings";

/** Saved settings over the defaults. Keys from older builds (the divider adapter) are dropped. */
export function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Settings> & { adapter?: unknown };
    const { adapter: _dropped, ...known } = saved;
    const s: Settings = { ...DEFAULT_SETTINGS, ...known };
    if (s.theme !== "light" && s.theme !== "dark") s.theme = "system";
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

export const resolveTheme = (choice: ThemeChoice, systemDark: boolean): Theme => (choice === "system" ? (systemDark ? "dark" : "light") : choice);

export function applyTheme(theme: Theme) {
  if (typeof document !== "undefined") document.documentElement.setAttribute("data-theme", theme);
}

const darkQuery = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null);
export const systemPrefersDark = () => !!darkQuery()?.matches;

/** Calls back with the system preference whenever it changes. */
export function watchSystemTheme(cb: (dark: boolean) => void): () => void {
  const q = darkQuery();
  const on = () => cb(!!q?.matches);
  q?.addEventListener("change", on);
  return () => q?.removeEventListener("change", on);
}
