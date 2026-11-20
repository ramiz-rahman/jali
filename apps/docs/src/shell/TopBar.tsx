/** The bar across the top: lockup, search, theme, GitHub; on a phone, the menu button that opens the nav drawer. */
import { useEffect, useRef, type KeyboardEvent } from "react";
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
import { setTheme, useTheme, type ThemeChoice } from "../site/theme";
import { Lockup } from "./brand";
import { Nav } from "./Nav";
import { useIsMac } from "./Search";

const THEMES: { value: ThemeChoice; label: string; Icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
];

function ThemeToggle() {
  const choice = useTheme();
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = THEMES.findIndex((t) => t.value === choice);
    const to =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? (i + 1) % 3
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? (i + 2) % 3
          : -1;
    if (to < 0) return;
    e.preventDefault();
    setTheme(THEMES[to]!.value);
    (e.currentTarget.querySelectorAll("button")[to] as HTMLButtonElement | undefined)?.focus();
  };
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Colour theme" onKeyDown={onKey}>
      {THEMES.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          aria-label={label}
          title={label}
          tabIndex={choice === value ? 0 : -1}
          onClick={() => setTheme(value)}
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

export function TopBar({
  onSearch,
  onMenu,
  menuOpen,
  path,
  landing,
}: {
  onSearch: () => void;
  onMenu: () => void;
  menuOpen?: boolean;
  path: string;
  landing?: boolean;
}) {
  const mac = useIsMac();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button
          type="button"
          className="icon-button menu-button"
          aria-label="Open the docs menu"
          aria-haspopup="dialog"
          aria-expanded={!!menuOpen}
          onClick={onMenu}
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
            onClick={onSearch}
            aria-label="Search the docs"
            aria-keyshortcuts="Meta+K Control+K /"
          >
            <MagnifyingGlassIcon aria-hidden size={16} />
            <span className="search-button-label">Search</span>
            <kbd className="kbd search-button-kbd">{mac ? "⌘" : "Ctrl "}K</kbd>
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
export function NavDrawer({
  open,
  path,
  onClose,
}: {
  open: boolean;
  path: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    onClose();
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-label="Docs menu"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget || (e.target as Element).closest("a")) onClose();
      }}
    >
      <div className="drawer-panel">
        <div className="drawer-head">
          <a className="brand" href="/" aria-label="Jali docs, home">
            <Lockup className="brand-lockup" />
          </a>
          <button
            type="button"
            className="icon-button"
            aria-label="Close the menu"
            onClick={onClose}
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
