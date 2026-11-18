/**
 * The site: top bar, nav, the page for the current path, and "On this page". The page stays on screen until the
 * next one has loaded, so moving between pages never flashes empty.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { MDXProvider } from "@mdx-js/react";
import { pages, type Frontmatter } from "../site/pages";
import { usePath, useLinkInterception } from "../site/router";
import { sources, toMarkdown } from "../site/sources";
import { SITE_NAME } from "../site/config";
import { mdxComponents } from "./mdx";
import { Nav } from "./Nav";
import { NavDrawer, TopBar } from "./TopBar";
import { SearchDialog, useSearchShortcut } from "./Search";
import { Toc, TocDisclosure, useActiveHeading, useHeadings } from "./Toc";
import { PageFooter, PageHeader } from "./Page";
import { NotFound } from "./NotFound";

interface Loaded { path: string; Component: ComponentType | null; frontmatter?: Frontmatter }

const cache = new Map<string, Loaded>();

function useLoadedPage(path: string): Loaded | null {
  const [loaded, setLoaded] = useState<Loaded | null>(() => cache.get(path) ?? null);
  useEffect(() => {
    let live = true;
    const hit = cache.get(path);
    if (hit) { setLoaded(hit); return; }
    const load = pages[path];
    if (!load) { setLoaded({ path, Component: null }); return; }
    load().then((m) => {
      const value = { path, Component: m.default, frontmatter: m.frontmatter };
      cache.set(path, value);
      if (live) setLoaded(value);
    }, () => { if (live) setLoaded({ path, Component: null }); });
    return () => { live = false; };
  }, [path]);
  return loaded;
}

/** "/get-started/introduction.md": the page's Markdown, as plain text. */
function MarkdownView({ path }: { path: string }) {
  const page = sources[path];
  useEffect(() => { document.title = `${page?.title ?? "Not found"}.md · ${SITE_NAME}`; }, [page]);
  if (!page) return <NotFound path={`${path}.md`} />;
  return <pre className="markdown-view">{toMarkdown(page)}</pre>;
}

export function App() {
  useLinkInterception();
  const path = usePath();
  const mdMatch = /^(.*)\.md$/.exec(path);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useSearchShortcut(openSearch);

  const loaded = useLoadedPage(mdMatch ? "\0" : path);
  const [article, setArticle] = useState<HTMLElement | null>(null);
  const shown = loaded?.path ?? "";
  const entries = useHeadings(article, shown);
  const active = useActiveHeading(entries);

  // After a page changes: its title, the address's #section, and focus on the title for keyboard and screen readers.
  const first = useRef(true);
  useLayoutEffect(() => {
    if (!loaded) return;
    const fm = loaded.frontmatter;
    document.title = loaded.Component && fm ? (loaded.path === "/" ? `${SITE_NAME}: ${fm.summary}` : `${fm.title} · ${SITE_NAME}`) : `Not found · ${SITE_NAME}`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", fm?.summary ?? "");
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash) document.getElementById(hash)?.scrollIntoView();
    if (!first.current && !hash) document.querySelector<HTMLElement>("[data-page-focus]")?.focus({ preventScroll: true });
    first.current = false;
  }, [loaded]);

  if (mdMatch) return <MarkdownView path={mdMatch[1] || "/"} />;

  const isHome = shown === "/";
  // API reference entries use two columns (prose and options, then signature and example), so they take the TOC's room.
  const isWide = /^\/reference\/(core|react)(\/|$)/.test(shown);
  const Page = loaded?.Component;
  const fm = loaded?.frontmatter;

  return (
    <MDXProvider components={mdxComponents}>
      <a className="skip-link" href="#content">Skip to content</a>
      <TopBar onSearch={openSearch} onMenu={() => setMenuOpen(true)} />
      <div className="layout" data-home={isHome || undefined} data-wide={isWide || undefined} data-toc={entries.length && !isHome ? "" : undefined}>
        <div className="sidebar">
          <div className="sidebar-inner"><Nav path={path} /></div>
        </div>
        <main id="content" className="main" tabIndex={-1}>
          {loaded && !Page ? <NotFound path={path} /> : null}
          {Page && fm ? (
            <article className="article" ref={setArticle} data-path={shown}>
              {isHome ? <h1 className="visually-hidden" tabIndex={-1} data-page-focus="">{fm.title}</h1> : (
                <div tabIndex={-1} data-page-focus="" className="focus-target"><PageHeader path={shown} title={fm.title} summary={fm.summary} /></div>
              )}
              {!isHome ? <TocDisclosure entries={entries} active={active} /> : null}
              <div className="prose" data-home={isHome || undefined}><Page /></div>
              {!isHome ? <PageFooter path={shown} /> : null}
            </article>
          ) : null}
        </main>
        {!isHome && !isWide ? (
          <div className="toc-column">
            <div className="toc-inner"><Toc entries={entries} active={active} /></div>
          </div>
        ) : null}
      </div>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NavDrawer open={menuOpen} path={path} onClose={closeMenu} />
    </MDXProvider>
  );
}
