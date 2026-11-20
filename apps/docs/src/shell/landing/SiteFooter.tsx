/**
 * The site footer: a lattice screen along its top edge, the brand and one line on what Jali is, and four columns
 * (Docs, Learn, Reference, Project). Titles come from the pages, so a renamed page renames its link here.
 * Written for the landing; it can sit under the docs pages as well.
 */
import { ArrowUpRightIcon } from "@phosphor-icons/react";
import { REPO_URL } from "../../site/config";
import { resolvedNav } from "../../site/sources";
import { Lattice, Lockup } from "../brand";
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
        { href: "/reference/core", title: "@jali/core" },
        { href: "/reference/react", title: "@jali/react" },
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
        { href: `${REPO_URL}/blob/main/LICENSE`, title: "Licence", external: true },
      ],
    },
  ];
}

export function SiteFooter() {
  return (
    <footer className="site-footer" data-toc-skip="">
      <div className="site-footer-screen" aria-hidden>
        {Array.from({ length: 24 }, (_, i) => (
          <Lattice key={i} className="site-footer-arch" />
        ))}
      </div>
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <a href="/" className="site-footer-home" aria-label="Jali, home">
            <Lockup className="site-footer-lockup" />
          </a>
          <p className="site-footer-line">
            Workspaces of panes for React. Panes fold into tabs when the window is too small, and
            come back when there is room.
          </p>
        </div>
        <nav className="site-footer-nav" aria-label="Footer">
          {columns().map((c) => (
            <div key={c.title} className="site-footer-col">
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
        <p className="site-footer-legal">
          <span>
            Designed and built by <Maker />
          </span>
          <span>Licence to come.</span>
        </p>
      </div>
    </footer>
  );
}
