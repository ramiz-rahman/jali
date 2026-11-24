/**
 * The site around a page: top bar, nav, the page, "On this page", and the footer. Rendered to static HTML at build
 * time (src/pages/[...slug].astro); nothing here hydrates. The page's own HTML comes in already rendered
 * (src/shell/render.tsx), with its islands in place.
 */
import { Nav } from "./Nav";
import { NavDrawer, TopBar } from "./TopBar";
import { Toc, TocDisclosure, type TocEntry } from "./Toc";
import { PageFooter, PageHeader } from "./Page";
import { SiteFooter } from "./landing/SiteFooter";
import { NotFound } from "./NotFound";

export type ShellProps =
  | {
      kind: "page";
      path: string;
      title: string;
      summary: string;
      /** The page's content, rendered. */
      html: string;
      headings: TocEntry[];
    }
  | { kind: "not-found" };

export function Shell(props: ShellProps) {
  const path = props.kind === "page" ? props.path : "/404";
  const isHome = path === "/";
  // API reference entries use two columns (prose and options, then signature and example), so they take the TOC's room.
  // Wide: the reference for the two entries (signatures beside examples) and the Examples page (large screenshots).
  const isWide = /^\/reference\/(core|react)(\/|$)/.test(path) || path === "/examples";
  const entries = props.kind === "page" && !isHome ? props.headings : [];

  return (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <TopBar path={path} landing={isHome} />
      <div
        className="layout"
        data-home={isHome || undefined}
        data-wide={isWide || undefined}
        data-toc={entries.length ? "" : undefined}
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
          {props.kind === "not-found" ? <NotFound /> : null}
          {props.kind === "page" ? (
            <article className="article" data-path={path}>
              {isHome ? null : (
                <PageHeader path={path} title={props.title} summary={props.summary} />
              )}
              {!isHome ? <TocDisclosure entries={entries} /> : null}
              <div
                className="prose"
                data-home={isHome || undefined}
                dangerouslySetInnerHTML={{ __html: props.html }}
              />
              {!isHome ? <PageFooter path={path} /> : null}
            </article>
          ) : null}
        </main>
        {!isHome && !isWide ? (
          <div className="toc-column">
            <div className="toc-inner">
              <Toc entries={entries} />
            </div>
          </div>
        ) : null}
      </div>
      {/* The landing renders its own footer; every other page ends with the same one. */}
      {props.kind === "page" && !isHome ? (
        <div className="docs-footer">
          <SiteFooter />
        </div>
      ) : null}
      <NavDrawer path={path} />
    </>
  );
}
