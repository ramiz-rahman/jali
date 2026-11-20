/**
 * Renders a page to static HTML at build time: its MDX through the docs' components, with the headings it holds
 * (for "On this page" and search) and its islands rendered in place. The routes (src/pages) and the search index
 * use it; each page is rendered once per build.
 */
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MDXProvider } from "@mdx-js/react";
import { pages } from "../site/pages";
import { islandPrefix } from "../client/island-id";
import { Collect, type Collected, type TocEntry } from "./collect";
import { IslandBoundary } from "./ErrorBoundary";
import { islandMarker } from "./island";
import { mdxComponents } from "./mdx";
import { Shell, type ShellProps } from "./Shell";

export interface RenderedPage {
  html: string;
  headings: TocEntry[];
}

const cache = new Map<string, Promise<RenderedPage>>();

export function renderPage(path: string): Promise<RenderedPage> {
  let hit = cache.get(path);
  if (!hit) {
    hit = render(path);
    cache.set(path, hit);
  }
  return hit;
}

async function render(path: string): Promise<RenderedPage> {
  const load = pages[path];
  if (!load) throw new Error(`No page at ${path}`);
  const { default: Page } = await load();
  const collected: Collected = { headings: [], islands: [] };
  let html = renderToString(
    <Collect.Provider value={collected}>
      <MDXProvider components={mdxComponents}>
        <Page />
      </MDXProvider>
    </Collect.Provider>,
    { identifierPrefix: "c-" },
  );
  // Each island on its own, as the browser will hydrate it (src/client/islands.ts): the same tree, the same ids.
  collected.islands.forEach(({ Component, props }, n) => {
    const island = renderToString(
      createElement(IslandBoundary, null, createElement(Component, props)),
      { identifierPrefix: islandPrefix(n) },
    );
    html = html.replace(islandMarker(n), () => island);
  });
  return { html, headings: collected.headings };
}

/** The site around a page, or the 404 page, as HTML. */
export const renderShell = (props: ShellProps) =>
  renderToString(<Shell {...props} />, { identifierPrefix: "s-" });
