/**
 * The bar across the top: lockup, search, theme, GitHub; on a phone, the menu button that opens the nav drawer.
 * Static HTML: src/client/enhance.ts makes the search button, the theme toggle and the drawer work.
 */
import {
  GithubLogoIcon,
  ListIcon,
  MagnifyingGlassIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  XIcon,
} from "@phosphor-icons/react";
import { REPO_URL } from "../site/config";
import { Lockup } from "./brand";
import { Nav } from "./Nav";

const THEMES = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
] as const;

/**
 * Light, dark or system. The chosen one is drawn from `data-theme-choice` on <html>, which an inline script sets
 * before the first paint (src/layouts/Document.astro), so the right button is lit from the start; the script in
 * the browser then sets `aria-checked` and the roving tab stop.
 */
function ThemeToggle() {
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Colour theme" data-theme-toggle="">
      {THEMES.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={value === "system"}
          aria-label={label}
          title={label}
          tabIndex={value === "system" ? 0 : -1}
          data-choice={value}
        >
          <Icon aria-hidden size={15} />
        </button>
      ))}
    </div>
  );
}

/** The site's sections, in the top bar on every page: the landing and the docs are separate places. */
const SECTIONS = [
  {
    title: "Docs",
    href: "/get-started/introduction",
    match: (p: string) => /^\/(get-started|learn|guides)(\/|$)/.test(p),
  },
  { title: "Reference", href: "/reference/core", match: (p: string) => p.startsWith("/reference") },
  { title: "Examples", href: "/examples", match: (p: string) => p.startsWith("/examples") },
];

export function TopBar({ path, landing }: { path: string; landing?: boolean }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button
          type="button"
          className="icon-button menu-button"
          aria-label="Open the docs menu"
          aria-haspopup="dialog"
          aria-expanded={false}
          aria-controls="nav-drawer"
          data-drawer-open=""
        >
          <ListIcon aria-hidden size={20} />
        </button>
        <a className="brand" href="/" aria-label="Jali, home">
          <Lockup className="brand-lockup" />
        </a>
        <nav className="topbar-sections" aria-label="Site">
          {SECTIONS.map((s) => (
            <a
              key={s.href}
              className="topbar-section"
              href={s.href}
              aria-current={!landing && s.match(path) ? "page" : undefined}
            >
              {s.title}
            </a>
          ))}
        </nav>
        <div className="topbar-actions">
          <button
            type="button"
            className="search-button"
            aria-label="Search the docs"
            aria-keyshortcuts="Meta+K Control+K /"
            aria-haspopup="dialog"
            data-search-open=""
          >
            <MagnifyingGlassIcon aria-hidden size={16} />
            <span className="search-button-label">Search</span>
            {/* Written for Windows and Linux; the browser says ⌘K on a Mac. */}
            <kbd className="kbd search-button-kbd">Ctrl K</kbd>
          </button>
          <ThemeToggle />
          <a
            className="icon-button"
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Jali on GitHub"
            title="GitHub"
          >
            <GithubLogoIcon aria-hidden size={18} weight="fill" />
          </a>
        </div>
      </div>
    </header>
  );
}

/** The nav as a modal drawer, below 768px. A native <dialog>: focus stays inside, Escape closes it, the page behind is inert. */
export function NavDrawer({ path }: { path: string }) {
  return (
    <dialog className="drawer" id="nav-drawer" aria-label="Docs menu">
      <div className="drawer-panel">
        <div className="drawer-head">
          <a className="brand" href="/" aria-label="Jali docs, home">
            <Lockup className="brand-lockup" />
          </a>
          <button
            type="button"
            className="icon-button"
            aria-label="Close the menu"
            data-drawer-close=""
            autoFocus
          >
            <XIcon aria-hidden size={20} />
          </button>
        </div>
        <Nav path={path} />
      </div>
    </dialog>
  );
}
