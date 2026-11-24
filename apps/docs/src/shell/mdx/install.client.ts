/**
 * The package-manager menu on each install line (./Install.tsx): `[data-pm-trigger]` opens its listbox
 * (`[data-pm-menu]`, the trigger's aria-controls). Focus goes to the list, which marks one option active
 * (`aria-activedescendant`, `data-active`): the arrows, Home, End and a letter move it, Enter or Space chooses it,
 * Escape closes the menu, and Tab or a click elsewhere closes it too. Choosing is the line's choice group's
 * (./choice.client.ts), so every install line follows.
 */
import { all, rovingIndex } from "../../client/dom";
import { choose } from "./choice.client";

export function initInstallMenus() {
  let open: { menu: HTMLElement; trigger: HTMLElement } | null = null;
  const options = (menu: HTMLElement) => all("[data-choice-option]", menu);
  const activate = (menu: HTMLElement, option: HTMLElement | undefined) => {
    if (!option) return;
    for (const o of options(menu)) o.toggleAttribute("data-active", o === option);
    menu.setAttribute("aria-activedescendant", option.id);
    option.scrollIntoView({ block: "nearest" });
  };
  const close = (focusTrigger: boolean) => {
    if (!open) return;
    const { menu, trigger } = open;
    open = null;
    menu.hidden = true;
    menu.removeAttribute("aria-activedescendant");
    trigger.setAttribute("aria-expanded", "false");
    if (focusTrigger) trigger.focus();
  };
  const show = (trigger: HTMLElement, at: "selected" | "first" | "last" = "selected") => {
    const menu = document.getElementById(trigger.getAttribute("aria-controls") ?? "");
    if (!menu) return;
    close(false);
    open = { menu, trigger };
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    const list = options(menu);
    const start =
      at === "first"
        ? list[0]
        : at === "last"
          ? list.at(-1)
          : (list.find((o) => o.getAttribute("aria-selected") === "true") ?? list[0]);
    activate(menu, start);
    menu.focus();
  };
  const pick = (option: HTMLElement) => {
    const group = option.closest<HTMLElement>("[data-choice-group]");
    close(true);
    if (group) choose(group, option.dataset.choiceOption!);
  };
  const inMenu = (target: EventTarget | null) =>
    (target as Element | null)?.closest?.<HTMLElement>("[data-pm-menu] [data-choice-option]");

  document.addEventListener("click", (e) => {
    const trigger = (e.target as Element).closest<HTMLElement>("[data-pm-trigger]");
    if (trigger) {
      if (open?.trigger === trigger) close(true);
      else show(trigger);
      return;
    }
    const option = inMenu(e.target);
    if (option) pick(option);
  });
  // A press outside the open menu closes it, before the press does anything else.
  document.addEventListener("pointerdown", (e) => {
    if (open && !open.menu.parentElement!.contains(e.target as Node)) close(false);
  });
  // A press on an option keeps focus on the list, so the menu is still open when the click arrives.
  document.addEventListener("mousedown", (e) => {
    if (open && open.menu.contains(e.target as Node)) e.preventDefault();
  });
  document.addEventListener("pointermove", (e) => {
    const option = inMenu(e.target);
    if (open && option && open.menu.contains(option)) activate(open.menu, option);
  });
  document.addEventListener("keydown", (e) => {
    const trigger = (e.target as Element).closest?.<HTMLElement>("[data-pm-trigger]");
    if (trigger && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      show(trigger, e.key === "ArrowDown" ? "selected" : "last");
      return;
    }
    if (!open || e.target !== open.menu) return;
    const { menu } = open;
    const list = options(menu);
    const now = list.findIndex((o) => o.hasAttribute("data-active"));
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (list[now]) pick(list[now]);
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      // A letter: the next option that starts with it.
      const key = e.key.toLowerCase();
      const from = list.slice(now + 1).concat(list.slice(0, now + 1));
      activate(
        menu,
        from.find((o) => o.dataset.choiceOption!.startsWith(key)),
      );
    } else {
      const to = rovingIndex(e, now, list.length, true);
      if (to < 0 || e.key === "ArrowLeft" || e.key === "ArrowRight") return;
      e.preventDefault();
      activate(menu, list[to]);
    }
  });
  document.addEventListener("focusout", (e) => {
    if (
      open &&
      e.target === open.menu &&
      !open.menu.parentElement!.contains(e.relatedTarget as Node)
    )
      close(false);
  });
}
