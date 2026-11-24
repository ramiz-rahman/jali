/**
 * The theme toggle in the top bar (./TopBar.tsx: `[data-theme-toggle]`, a radio group of `[data-choice]` buttons).
 * One mechanism, the same as jali's: `data-theme` on <html> is always the resolved theme ("light" or "dark"), so the
 * --jali-* tokens and the live workspaces switch together; `data-theme-choice` is the reader's choice, remembered.
 * The inline script in src/layouts/Document.astro applies it before the first paint; this keeps it current.
 */
import { all, rovingIndex } from "../client/dom";
import { readStored, STORAGE_KEYS, writeStored } from "../ui/lib/storage";

type ThemeChoice = "light" | "dark" | "system";

const stored = (): ThemeChoice => {
  const v = readStored(STORAGE_KEYS.theme);
  return v === "light" || v === "dark" ? v : "system";
};

export function initTheme() {
  const root = document.documentElement;
  const dark = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = (choice: ThemeChoice) => {
    root.setAttribute(
      "data-theme",
      choice === "dark" || (choice === "system" && dark.matches) ? "dark" : "light",
    );
    root.setAttribute("data-theme-choice", choice);
    for (const b of all("[data-theme-toggle] [data-choice]")) {
      const on = b.dataset.choice === choice;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    }
  };
  const choose = (b: HTMLButtonElement | null | undefined) => {
    if (!b) return;
    const c = b.dataset.choice as ThemeChoice;
    writeStored(STORAGE_KEYS.theme, c);
    apply(c);
  };

  apply(stored());
  dark.addEventListener("change", () => apply(stored()));
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEYS.theme) apply(stored());
  });
  for (const group of all("[data-theme-toggle]")) {
    const buttons = all<HTMLButtonElement>("[data-choice]", group);
    group.addEventListener("click", (e) =>
      choose((e.target as Element).closest<HTMLButtonElement>("[data-choice]")),
    );
    group.addEventListener("keydown", (e) => {
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const to = rovingIndex(e, Math.max(0, i), buttons.length, true);
      if (to < 0 || e.key === "Home" || e.key === "End") return;
      e.preventDefault();
      choose(buttons[to]);
      buttons[to]?.focus();
    });
  }
}
