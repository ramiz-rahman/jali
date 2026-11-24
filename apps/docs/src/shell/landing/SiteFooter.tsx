/**
 * The site footer, the opening's bookend: a row of cells (what Jali is, then Docs, Learn, Reference and Project) split
 * by dividers as panes are, then the lockup, large, in the centre of the opening's grid with a hatched tile either
 * side, then who made it and the licence. Titles come from the pages, so a renamed page renames its link here. Ends
 * the landing, and every docs page.
 */
import { ArrowUpRightIcon } from "@phosphor-icons/react";
import { REPO_URL } from "../../site/config";
import { resolvedNav } from "../../site/sources";
import { Lockup } from "../brand";
import { Maker } from "../../../../../examples/shared/src/maker/maker";

const titleOf = (path: string, fallback: string) =>
  resolvedNav()
    .flatMap((s) => s.items)
    .find((i) => i.path === path)?.title ?? fallback;

interface Link {
  href: string;
  title: string;
  external?: boolean;
}

function columns(): { title: string; links: Link[] }[] {
  const nav = resolvedNav();
  const section = (name: string) =>
    nav.find((s) => s.title === name)?.items.map((i) => ({ href: i.path, title: i.title })) ?? [];
  return [
    { title: "Docs", links: section("Get started") },
    { title: "Learn", links: section("Learn") },
    {
      title: "Reference",
      links: [
        { href: "/reference/core", title: "jali" },
        { href: "/reference/react", title: "jali/react" },
        { href: "/reference/tokens", title: titleOf("/reference/tokens", "Tokens") },
        { href: "/reference/commands", title: titleOf("/reference/commands", "Commands") },
      ],
    },
    {
      title: "Project",
      links: [
        { href: REPO_URL, title: "GitHub", external: true },
        { href: "/examples", title: "Examples" },
        { href: "/llms.txt", title: "llms.txt" },
        { href: "/llms-full.txt", title: "llms-full.txt" },
      ],
    },
  ];
}

export function SiteFooter() {
  return (
    <footer className="site-footer" data-toc-skip="">
      <div className="site-footer-cells">
        <div className="site-footer-cell site-footer-about">
          <p className="site-footer-line">
            A new layout primitive for React apps: adaptive tiling panes your users arrange the way
            they work, on any screen.
          </p>
        </div>
        <nav className="site-footer-nav" aria-label="Footer">
          {columns().map((c) => (
            <div key={c.title} className="site-footer-cell site-footer-col">
              <p className="site-footer-heading" id={`footer-${c.title.toLowerCase()}`}>
                {c.title}
              </p>
              <ul aria-labelledby={`footer-${c.title.toLowerCase()}`}>
                {c.links.map((l) => (
                  <li key={l.href}>
                    <a
                      className="site-footer-link"
                      href={l.href}
                      {...(l.external ? { target: "_blank", rel: "noreferrer" } : {})}
                    >
                      {l.title}
                      {l.external ? <ArrowUpRightIcon aria-hidden size={13} /> : null}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="site-footer-signoff">
        <span className="site-footer-tile site-footer-tile-left" aria-hidden />
        <span className="site-footer-tile site-footer-tile-right" aria-hidden />
        <span className="site-footer-split" aria-hidden />
        <a href="/" className="site-footer-home" aria-label="Jali, home">
          <Lockup className="site-footer-lockup" />
        </a>
      </div>
      <p className="site-footer-legal">
        <span>
          Designed and built by <Maker />
        </span>
        <span>
          <a href={`${REPO_URL}/blob/master/LICENSE`}>Apache-2.0</a>
        </span>
      </p>
    </footer>
  );
}
