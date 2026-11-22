/** The examples' ⌘K "Switch between light and dark": the other theme from the one on screen, as a Jali setting. */
import type { Command, Jali } from "jali";

/** Changes Jali's theme setting to the one not on screen now (which, under "system", is the system's). */
export function switchTheme(jali: Jali) {
  const { theme } = jali.get().settings;
  const systemDark = !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && systemDark);
  jali.actions.changeSettings({ theme: dark ? "light" : "dark" });
}

/** The command, under the app's own id (`markets.theme`). */
export const themeCommand = (id: string): Command => ({
  id,
  title: "Switch between light and dark",
  group: "Settings",
  run: switchTheme,
});
