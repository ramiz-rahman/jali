import type { ThemeChoice, Jali } from "@jali/core";

/**
 * Your app's own light/dark switch. Jali has a theme setting too (System, Light or Dark in its settings panel), and
 * writes the result to data-theme on <html>. Pass your choice to it, so both always agree.
 */
export function setTheme(jali: Jali, theme: ThemeChoice) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  jali.actions.changeSettings({ theme });
}
