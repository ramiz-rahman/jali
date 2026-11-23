/**
 * The one script every page loads: it makes the static HTML work. The theme toggle, code tools (copy, wrap lines),
 * tabs, "On this page", the nav drawer, the 404's address and videos, all on the elements the build wrote, with no
 * framework. Search loads its code the first time it is opened (./search.tsx); live parts hydrate as islands when
 * they come near the screen (./islands.ts).
 */
import { readStored, writeStored } from "../site/storage";
import { hydrateIslands } from "./islands";

const root = document.documentElement;
const all = <E extends Element = HTMLElement>(sel: string, from: ParentNode = document) => [
  ...from.querySelectorAll<E>(sel),
];

/** Arrow keys (and Home, End) along a row of `items`: the index to move to, or -1. */
function step(e: KeyboardEvent, i: number, n: number, vertical = false): number {
  const next = e.key === "ArrowRight" || (vertical && e.key === "ArrowDown");
  const prev = e.key === "ArrowLeft" || (vertical && e.key === "ArrowUp");
  if (next) return (i + 1) % n;
  if (prev) return (i - 1 + n) % n;
  if (e.key === "Home") return 0;
  if (e.key === "End") return n - 1;
  return -1;
}

// ---------- theme ----------

type ThemeChoice = "light" | "dark" | "system";
const THEME_KEY = "jali-docs-theme";
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

/** One mechanism, the same as jali's: `data-theme` on <html> is the resolved theme, so the live workspaces follow. */
function applyTheme(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && darkQuery.matches);
  root.setAttribute("data-theme", dark ? "dark" : "light");
  root.setAttribute("data-theme-choice", choice);
  for (const b of all("[data-theme-toggle] [data-choice]")) {
    const on = b.dataset.choice === choice;
    b.setAttribute("aria-checked", String(on));
    b.tabIndex = on ? 0 : -1;
  }
}
const themeChoice = (): ThemeChoice => {
  const v = readStored(THEME_KEY);
  return v === "light" || v === "dark" ? v : "system";
};

function initTheme() {
  applyTheme(themeChoice());
  darkQuery.addEventListener("change", () => applyTheme(themeChoice()));
  window.addEventListener("storage", (e) => {
    if (e.key === THEME_KEY) applyTheme(themeChoice());
  });
  for (const group of all("[data-theme-toggle]")) {
    const buttons = all<HTMLButtonElement>("[data-choice]", group);
    const choose = (b: HTMLButtonElement | undefined) => {
      if (!b) return;
      const c = b.dataset.choice as ThemeChoice;
      writeStored(THEME_KEY, c);
      applyTheme(c);
    };
    group.addEventListener("click", (e) =>
      choose((e.target as Element).closest<HTMLButtonElement>("[data-choice]") ?? undefined),
    );
    group.addEventListener("keydown", (e) => {
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const to = step(e, Math.max(0, i), buttons.length, true);
      if (to < 0 || e.key === "Home" || e.key === "End") return;
      e.preventDefault();
      choose(buttons[to]);
      buttons[to]?.focus();
    });
  }
}

// ---------- code: copy and wrap ----------

export async function copyText(text: string | Promise<string>): Promise<boolean> {
  // A promise goes to the clipboard as it is, so a copy that waits for a download keeps the click's permission.
  if (
    typeof text !== "string" &&
    typeof ClipboardItem !== "undefined" &&
    navigator.clipboard?.write
  ) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })),
        }),
      ]);
      return true;
    } catch {
      /* fall through: copy the text once it is here */
    }
  }
  const value = await text;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** A block's text as written: each line's text, without the zero-width space that holds an empty line open. */
const codeText = (pre: Element | null | undefined) =>
  pre
    ? all(".code-line", pre)
        .map((l) => (l.textContent ?? "").replace(/​/g, ""))
        .join("\n")
    : "";

const copiedTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>();
function showCopied(button: HTMLElement, ok: boolean, idle: { label?: string; text?: string }) {
  if (!ok) return;
  const live = button.querySelector<HTMLElement>("[aria-live]");
  button.setAttribute("data-copied", "");
  if (idle.label) {
    button.setAttribute("aria-label", "Copied");
    button.title = "Copied";
  }
  if (live) live.textContent = "Copied";
  clearTimeout(copiedTimers.get(button));
  copiedTimers.set(
    button,
    setTimeout(() => {
      button.removeAttribute("data-copied");
      if (idle.label) {
        button.setAttribute("aria-label", idle.label);
        button.title = idle.label;
      }
      if (live) live.textContent = idle.text ?? "";
    }, 1600),
  );
}

const WRAP_KEY = "jali-docs-code-wrap";
function setWrap(on: boolean) {
  root.toggleAttribute("data-code-wrap", on);
  for (const b of all("[data-wrap-toggle]")) b.setAttribute("aria-pressed", String(on));
}

function initCode() {
  setWrap(root.hasAttribute("data-code-wrap"));
  window.addEventListener("storage", (e) => {
    if (e.key === WRAP_KEY) setWrap(e.newValue === "1");
  });
  document.addEventListener("click", (e) => {
    const target = e.target as Element;
    const wrap = target.closest<HTMLElement>("[data-wrap-toggle]");
    if (wrap) {
      // Blocks above change height: keep the button where the reader's pointer is.
      const top = wrap.getBoundingClientRect().top;
      const on = !root.hasAttribute("data-code-wrap");
      writeStored(WRAP_KEY, on ? "1" : "0");
      setWrap(on);
      const moved = wrap.getBoundingClientRect().top - top;
      if (Math.abs(moved) > 1) window.scrollBy({ top: moved, behavior: "instant" });
      return;
    }
    const copy = target.closest<HTMLElement>("[data-copy-code]");
    if (copy) {
      const figure = copy.closest(".code");
      // Install: the command for the package manager chosen; a code block: its one <pre>.
      const pre =
        figure?.querySelector("[data-pm-panel]:not([hidden]) .code-pre") ??
        figure?.querySelector(".code-pre");
      const label = copy.getAttribute("aria-label") ?? "Copy code";
      void copyText(codeText(pre)).then((ok) => showCopied(copy, ok, { label }));
      return;
    }
    const page = target.closest<HTMLElement>("[data-copy-page]");
    if (page) {
      const md = fetch(page.dataset.copyPage!).then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.text();
      });
      void copyText(md)
        .catch(() => false)
        .then((ok) => showCopied(page, ok, { text: "Copy page" }));
    }
  });
}

// ---------- tabs ----------

const tabKey = (group: string) => `jali-docs-tab:${group}`;

function selectTab(set: Element, label: string) {
  // An install line (<Install>): a menu of package managers, and one command per manager.
  const select = set.querySelector<HTMLSelectElement>("[data-pm-select]");
  if (select) {
    if (![...select.options].some((o) => o.value === label)) return;
    select.value = label;
    for (const panel of all("[data-pm-panel]", set)) panel.hidden = panel.dataset.pmPanel !== label;
    return;
  }
  const tabs = all<HTMLButtonElement>("[role=tab]", set.querySelector("[role=tablist]") ?? set);
  if (!tabs.some((t) => t.dataset.tabLabel === label)) return;
  for (const t of tabs) {
    const on = t.dataset.tabLabel === label;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    const panel = document.getElementById(t.getAttribute("aria-controls") ?? "");
    if (panel) panel.hidden = !on;
  }
}

function initTabs() {
  const sets = all("[data-tabs]");
  // A group's remembered choice applies to every set of that group on the page.
  for (const set of sets) {
    const group = set.dataset.tabs;
    const stored = group ? readStored(tabKey(group)) : null;
    if (stored) selectTab(set, stored);
  }
  const choose = (set: HTMLElement, label: string) => {
    const group = set.dataset.tabs;
    if (!group) return selectTab(set, label);
    writeStored(tabKey(group), label);
    for (const s of sets) if (s.dataset.tabs === group) selectTab(s, label);
  };
  document.addEventListener("change", (e) => {
    const select = (e.target as Element).closest?.<HTMLSelectElement>("[data-pm-select]");
    const set = select?.closest<HTMLElement>("[data-tabs]");
    if (select && set) choose(set, select.value);
  });
  document.addEventListener("click", (e) => {
    const tab = (e.target as Element).closest<HTMLButtonElement>("[data-tabs] [role=tab]");
    const set = tab?.closest<HTMLElement>("[data-tabs]");
    if (tab && set) choose(set, tab.dataset.tabLabel!);
  });
  document.addEventListener("keydown", (e) => {
    const tab = (e.target as Element).closest?.<HTMLButtonElement>("[data-tabs] [role=tab]");
    const set = tab?.closest<HTMLElement>("[data-tabs]");
    if (!tab || !set) return;
    const tabs = all<HTMLButtonElement>("[role=tab]", tab.parentElement!);
    const to = step(e, tabs.indexOf(tab), tabs.length);
    if (to < 0) return;
    e.preventDefault();
    choose(set, tabs[to]!.dataset.tabLabel!);
    tabs[to]!.focus();
  });
}

// ---------- on this page ----------

function initToc() {
  const links = all<HTMLAnchorElement>(".toc-link");
  // The disclosure on narrow screens folds away once a section is chosen.
  for (const a of links)
    a.addEventListener("click", () => a.closest("details")?.removeAttribute("open"));
  const ids = [...new Set(links.map((a) => decodeURIComponent(a.hash.slice(1))))];
  const headings = ids
    .map((id) => document.getElementById(id))
    .filter((h): h is HTMLElement => !!h);
  if (!headings.length) return;
  let frame = 0;
  let current: string | undefined;
  const update = () => {
    frame = 0;
    const offset = 120;
    let id = headings[0]!.id;
    for (const h of headings) if (h.getBoundingClientRect().top - offset <= 0) id = h.id;
    // At the very bottom, the last heading is the one being read.
    if (window.innerHeight + window.scrollY >= root.scrollHeight - 4) id = headings.at(-1)!.id;
    if (id === current) return;
    current = id;
    for (const a of links) {
      if (decodeURIComponent(a.hash.slice(1)) === id) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    }
  };
  const later = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  update();
  window.addEventListener("scroll", later, { passive: true });
  window.addEventListener("resize", later);
}

// ---------- the nav drawer ----------

function initDrawer() {
  const drawer = document.querySelector<HTMLDialogElement>("#nav-drawer");
  const open = document.querySelector<HTMLButtonElement>("[data-drawer-open]");
  if (!drawer || !open) return;
  open.addEventListener("click", () => {
    drawer.showModal();
    open.setAttribute("aria-expanded", "true");
  });
  drawer.addEventListener("close", () => open.setAttribute("aria-expanded", "false"));
  drawer.addEventListener("click", (e) => {
    const t = e.target as Element;
    if (t === drawer || t.closest("[data-drawer-close]") || t.closest("a")) drawer.close();
  });
}

// ---------- search ----------

const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

let search: Promise<typeof import("./search")> | null = null;
const loadSearch = () => (search ??= import("./search"));

function openSearch() {
  void loadSearch().then((m) => m.openSearch());
}

function initSearch() {
  if (isMac()) for (const k of all(".search-button-kbd")) k.textContent = "⌘K";
  for (const b of all("[data-search-open]")) {
    b.addEventListener("click", openSearch);
    // Fetch the search code while the pointer is on its way.
    b.addEventListener("pointerenter", () => void loadSearch(), { once: true });
    b.addEventListener("focus", () => void loadSearch(), { once: true });
  }
  window.addEventListener("keydown", (e) => {
    // Inside a live workspace, ⌘K is its command palette.
    if (e.defaultPrevented || (e.target instanceof Element && e.target.closest("[data-jali]")))
      return;
    const typing =
      e.target instanceof HTMLElement &&
      (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
    const shortcut =
      ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) ||
      (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey);
    if (!shortcut) return;
    e.preventDefault();
    openSearch();
  });
}

// ---------- media and the 404 ----------

/** Videos in pages play while on screen, unless the reader prefers less motion; their controls can pause them. */
function initVideos() {
  const videos = all<HTMLVideoElement>("video[data-autoplay]");
  if (!videos.length || !("IntersectionObserver" in window)) return;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  const paused = new WeakSet<HTMLVideoElement>();
  for (const v of videos) {
    // A reader who pauses it keeps it paused.
    v.addEventListener("pause", () => {
      if (v.isConnected && !document.hidden && v.dataset.auto !== "pausing") paused.add(v);
      delete v.dataset.auto;
    });
    v.addEventListener("play", () => paused.delete(v));
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting && !still.matches && !paused.has(v)) void v.play().catch(() => {});
        else if (!e.isIntersecting && !v.paused) {
          v.dataset.auto = "pausing";
          v.pause();
        }
      }
    },
    { threshold: 0.5 },
  );
  for (const v of videos) io.observe(v);
}

function initNotFound() {
  const slot = document.querySelector("[data-not-found-path]");
  if (!slot) return;
  const code = document.createElement("code");
  code.className = "inline-code";
  code.textContent = window.location.pathname;
  slot.replaceChildren(code);
}

initTheme();
initCode();
initTabs();
initToc();
initDrawer();
initSearch();
initVideos();
initNotFound();
hydrateIslands();
