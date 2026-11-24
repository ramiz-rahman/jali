/**
 * The site around a page, rendered to static HTML at build time (src/pages); nothing here hydrates. Every page has the
 * same chrome (the skip link, the top bar, the phone's nav drawer) around its layout, which its frontmatter names
 * (src/site/sources.ts): the docs layout (nav, the page, "On this page", in its `docs`, `wide` or `showcase` form),
 * or the landing's own. The page's HTML comes in already rendered (./render.tsx), with its islands in place.
 */
import type { ReactNode } from "react";
import type { PageLayout, PageSource } from "../site/sources";
import type { TocEntry } from "./collect";
import { Nav } from "./Nav";
import { NotFound } from "./NotFound";
import { PageFooter, PageHeader } from "./Page";
import { SiteFooter } from "./SiteFooter";
import { Toc, TocDisclosure } from "./Toc";
import { NavDrawer, TopBar } from "./TopBar";

/**
 * The docs layout's three forms. `wide` gives the page the room of the column beside it (the API reference's two-column
 * entries); "On this page" is then folded above the page, as on a narrow screen. `showcase` has no "On this page" at
 * all: the Examples pages are short, and open on their picture.
 */
const DOC_LAYOUTS: Record<
  Exclude<PageLayout, "landing">,
  { wide: boolean; toc: "column" | "folded" | "none" }
> = {
  docs: { wide: false, toc: "column" },
  wide: { wide: true, toc: "folded" },
  showcase: { wide: true, toc: "none" },
};

/** The chrome every page shares. `frame` is the width the top bar keeps to: the docs' columns, or the full window. */
function SiteChrome({
  path,
  frame,
  children,
}: {
  path: string;
  frame: "docs" | "full";
  children: ReactNode;
}) {
  return (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <TopBar path={path} frame={frame} />
      {children}
      <NavDrawer path={path} />
    </>
  );
}

function Sidebar({ path }: { path: string }) {
  return (
    <div className="sidebar">
      <div className="sidebar-inner">
        <Nav path={path} />
      </div>
    </div>
  );
}

export interface PageShellProps {
  page: PageSource;
  /** The page's content, rendered. */
  html: string;
  headings: TocEntry[];
}

export function PageShell({ page, html, headings }: PageShellProps) {
  if (page.layout === "landing")
    return (
      <SiteChrome path={page.path} frame="full">
        {/* Its own place, apart from the docs: no nav beside it, one frame for every block and the footer. */}
        <main id="content" className="landing-main" tabIndex={-1}>
          <div className="prose landing-frame" dangerouslySetInnerHTML={{ __html: html }} />
        </main>
        <div className="landing-frame">
          <SiteFooter />
        </div>
      </SiteChrome>
    );
  const { wide, toc } = DOC_LAYOUTS[page.layout];
  return (
    <SiteChrome path={page.path} frame="docs">
      <div className="layout" data-wide={wide || undefined}>
        <Sidebar path={page.path} />
        <main id="content" className="main" tabIndex={-1}>
          <article className="article">
            <PageHeader page={page} />
            {toc === "none" ? null : <TocDisclosure entries={headings} />}
            <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
            <PageFooter page={page} />
          </article>
        </main>
        {toc === "column" ? (
          <div className="toc-column">
            <div className="toc-inner">
              <Toc entries={headings} />
            </div>
          </div>
        ) : null}
      </div>
      <div className="docs-footer">
        <SiteFooter />
      </div>
    </SiteChrome>
  );
}

/** The 404: the docs' frame and nav around "There is no page here". */
export function NotFoundShell() {
  return (
    <SiteChrome path="/404" frame="docs">
      <div className="layout">
        <Sidebar path="/404" />
        <main id="content" className="main" tabIndex={-1}>
          <NotFound />
        </main>
      </div>
    </SiteChrome>
  );
}
