import type { ThemeChoice, UiStore } from "@jali/core";

/**
 * Your app's own light/dark switch. Jali has a theme setting too (System, Light or Dark in its settings panel), and
 * startUi writes the result to data-theme on <html>. Pass your choice to it, so both always agree.
 */
export function setTheme(store: UiStore, theme: ThemeChoice) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  store.set({ settings: { ...store.get().settings, theme } });
}
