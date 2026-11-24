/**
 * Choice groups: an element `[data-choice-group]` whose options (`[data-choice-option="x"]`) pick which of its panels
 * (`[data-choice-panel="x"]`) show. <Tabs> (./Tabs.tsx) is one, its tabs the options; so is every install line
 * (./Install.tsx), its menu's items the options and its commands and current name the panels. A group with a name
 * ("pm") is remembered across the site, and every group of that name on the page follows the choice.
 *
 * Clicks and the arrows choose a tab here; the install line's menu is ./install.client.ts, which chooses through
 * `choose`.
 */
import { all, rovingIndex } from "../../client/dom";
import { choiceKey, readStored, writeStored } from "../../ui/lib/storage";

/** A group's own options or panels: not those of a group inside it (an install line in a tab). */
const own = (group: Element, sel: string) =>
  all(sel, group).filter((el) => el.closest("[data-choice-group]") === group);

/** Show `value` in one group: its option selected (and, for a tab, the tab stop), its panels shown, the rest hidden. */
function show(group: Element, value: string) {
  const options = own(group, "[data-choice-option]");
  if (!options.some((o) => o.dataset.choiceOption === value)) return;
  for (const o of options) {
    const on = o.dataset.choiceOption === value;
    o.setAttribute("aria-selected", String(on));
    if (o.getAttribute("role") === "tab") o.tabIndex = on ? 0 : -1;
  }
  for (const p of own(group, "[data-choice-panel]")) p.hidden = p.dataset.choicePanel !== value;
}

/** Choose `value` in `group`: remembered, and shown in every group of its name, when it has one. */
export function choose(group: HTMLElement, value: string) {
  const name = group.dataset.choiceGroup;
  if (!name) return show(group, value);
  writeStored(choiceKey(name), value);
  for (const g of all(`[data-choice-group="${CSS.escape(name)}"]`)) show(g, value);
}

export function initChoices() {
  for (const group of all("[data-choice-group]")) {
    const name = group.dataset.choiceGroup;
    const stored = name ? readStored(choiceKey(name)) : null;
    if (stored) show(group, stored);
  }
  const tabOf = (e: Event) => {
    const tab = (e.target as Element).closest?.<HTMLElement>("[data-choice-group] [role=tab]");
    const group = tab?.closest<HTMLElement>("[data-choice-group]");
    return tab && group ? { tab, group } : null;
  };
  document.addEventListener("click", (e) => {
    const t = tabOf(e);
    if (t) choose(t.group, t.tab.dataset.choiceOption!);
  });
  document.addEventListener("keydown", (e) => {
    const t = tabOf(e);
    if (!t) return;
    const tabs = all<HTMLElement>("[role=tab]", t.tab.parentElement!);
    const to = rovingIndex(e, tabs.indexOf(t.tab), tabs.length);
    if (to < 0) return;
    e.preventDefault();
    choose(t.group, tabs[to]!.dataset.choiceOption!);
    tabs[to]!.focus();
  });
}
