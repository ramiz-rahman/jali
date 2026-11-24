import type { Jali } from "jali-layout";

/** Light to dark and back, from whichever shows now (the system's, when the setting follows it). */
export function toggleTheme(jali: Jali) {
  const { theme } = jali.get().settings;
  const systemDark = !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && systemDark);
  jali.actions.changeSettings({ theme: dark ? "light" : "dark" });
}
