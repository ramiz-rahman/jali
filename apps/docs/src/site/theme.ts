/**
 * The site's theme. One mechanism, the same as @jali/core's: `data-theme` on <html> is always the resolved theme
 * ("light" or "dark"), so the --jali-* tokens and the live workspaces switch together. The reader's choice
 * (light, dark or system) is kept in `data-theme-choice` and in localStorage; index.html applies it before the
 * first paint.
 */
import { useEffect, useSyncExternalStore } from "react";
import { readStored, writeStored } from "./storage";

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "jali-docs-theme";

const listeners = new Set<() => void>();
const query = () => window.matchMedia("(prefers-color-scheme: dark)");

function storedChoice(): ThemeChoice {
  const v = readStored(KEY);
  return v === "light" || v === "dark" ? v : "system";
}

let choice: ThemeChoice = typeof window === "undefined" ? "system" : storedChoice();

function apply() {
  const dark = choice === "dark" || (choice === "system" && query().matches);
  const root = document.documentElement;
  root.setAttribute("data-theme", dark ? "dark" : "light");
  root.setAttribute("data-theme-choice", choice);
}

export function setTheme(next: ThemeChoice) {
  choice = next;
  writeStored(KEY, next);
  apply();
  for (const l of listeners) l();
}

export function useTheme(): ThemeChoice {
  useEffect(() => {
    apply();
    const q = query();
    const onChange = () => { if (choice === "system") apply(); };
    q.addEventListener("change", onChange);
    return () => q.removeEventListener("change", onChange);
  }, []);
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => choice, () => "system");
}
