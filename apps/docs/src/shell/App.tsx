/**
 * The site: top bar, nav, the page for the current path, and "On this page". The page stays on screen until the
 * next one has loaded, so moving between pages never flashes empty.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { MDXProvider } from "@mdx-js/react";
import { pages, type Frontmatter } from "../site/pages";
import { InitialPath, usePath, useLinkInterception } from "../site/router";
import { SITE_NAME } from "../site/config";
import { mdxComponents } from "./mdx";
import { Nav } from "./Nav";
import { NavDrawer, TopBar } from "./TopBar";
import { SearchDialog, useSearchShortcut } from "./Search";
import { Toc, TocDisclosure, useActiveHeading, useHeadings } from "./Toc";
import { PageFooter, PageHeader } from "./Page";
import { SiteFooter } from "./landing";
import { NotFound } from "./NotFound";

interface Loaded {
  path: string;
  Component: ComponentType | null;
  frontmatter?: Frontmatter;
}

const cache = new Map<string, Loaded>();

/**
 * Puts a page's module in the cache before the first render, so the prerender (src/pages/[...slug].astro) and the
 * hydration that follows (Site.tsx) both render the page at once instead of an empty shell.
 */
export function seedPage(path: string, m: { default: ComponentType; frontmatter: Frontmatter }) {
  cache.set(path, { path, Component: m.default, frontmatter: m.frontmatter });
}

function useLoadedPage(path: string): Loaded | null {
  const [loaded, setLoaded] = useState<Loaded | null>(() => cache.get(path) ?? null);
  useEffect(() => {
    let live = true;
    const hit = cache.get(path);
    if (hit) {
      setLoaded(hit);
      return;
    }
    const load = pages[path];
    if (!load) {
      setLoaded({ path, Component: null });
      return;
    }
    load().then(
      (m) => {
        const value = { path, Component: m.default, frontmatter: m.frontmatter };
        cache.set(path, value);
        if (live) setLoaded(value);
      },
      () => {
        if (live) setLoaded({ path, Component: null });
      },
    );
    return () => {
      live = false;
    };
  }, [path]);
  return loaded;
}

/** The address's #section as an id. A malformed one ("#%") is used as it stands rather than throwing. */
function decodeHash(hash: string): string {
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

export function App() {
  useLinkInterception();
  const path = usePath();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useSearchShortcut(openSearch);

  const loaded = useLoadedPage(path);
  const [article, setArticle] = useState<HTMLElement | null>(null);
  const shown = loaded?.path ?? "";
  const entries = useHeadings(article, shown);
  const active = useActiveHeading(entries);

  // After a page changes: its title, the address's #section, and focus on the title for keyboard and screen readers.
  const first = useRef(true);
  useLayoutEffect(() => {
    if (!loaded) return;
    const fm = loaded.frontmatter;
    document.title =
      loaded.Component && fm
        ? loaded.path === "/"
          ? `${SITE_NAME}: ${fm.summary}`
          : `${fm.title} · ${SITE_NAME}`
        : `Not found · ${SITE_NAME}`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", fm?.summary ?? "");
    // Prerendered pages carry their own canonical address; keep it current as readers move between pages in place.
    if (loaded.Component) {
      const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (canonical) canonical.href = new URL(loaded.path, canonical.href).href;
    }
    const hash = decodeHash(window.location.hash.slice(1));
    if (hash) document.getElementById(hash)?.scrollIntoView();
    if (!first.current && !hash)
      document.querySelector<HTMLElement>("[data-page-focus]")?.focus({ preventScroll: true });
    first.current = false;
  }, [loaded]);

  const isHome = shown === "/";
  // API reference entries use two columns (prose and options, then signature and example), so they take the TOC's room.
  const isWide = /^\/reference\/(core|react)(\/|$)/.test(shown);
  const Page = loaded?.Component;
  const fm = loaded?.frontmatter;

  return (
    <MDXProvider components={mdxComponents}>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <TopBar
        onSearch={openSearch}
        onMenu={() => setMenuOpen(true)}
        menuOpen={menuOpen}
        path={shown}
        landing={isHome}
      />
      <div
        className="layout"
        data-home={isHome || undefined}
        data-wide={isWide || undefined}
        data-toc={entries.length && !isHome ? "" : undefined}
      >
        {/* The landing page is its own place: no docs nav beside it. */}
        {!isHome ? (
          <div className="sidebar">
            <div className="sidebar-inner">
              <Nav path={path} />
            </div>
          </div>
        ) : null}
        <main id="content" className="main" tabIndex={-1}>
          {loaded && !Page ? <NotFound path={path} /> : null}
          {Page && fm ? (
            <article className="article" ref={setArticle} data-path={shown}>
              {isHome ? null : (
                <div tabIndex={-1} data-page-focus="" className="focus-target">
                  <PageHeader path={shown} title={fm.title} summary={fm.summary} />
                </div>
              )}
              {!isHome ? <TocDisclosure entries={entries} active={active} /> : null}
              <div className="prose" data-home={isHome || undefined}>
                <Page />
              </div>
              {!isHome ? <PageFooter path={shown} /> : null}
            </article>
          ) : null}
        </main>
        {!isHome && !isWide ? (
          <div className="toc-column">
            <div className="toc-inner">
              <Toc entries={entries} active={active} />
            </div>
          </div>
        ) : null}
      </div>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      {/* The landing renders its own footer; every docs page ends with the same one. */}
      {!isHome && Page ? (
        <div className="docs-footer">
          <SiteFooter />
        </div>
      ) : null}
      <NavDrawer open={menuOpen} path={path} onClose={closeMenu} />
    </MDXProvider>
  );
}
