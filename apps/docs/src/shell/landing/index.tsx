/**
 * The landing page at "/": its own place, apart from the docs. One story, top to bottom:
 *   the opening (what Jali is, install, the two actions) over the live workspace;
 *   the whole quickstart app beside what it renders;
 *   the four reasons, each live, on one numbered path;
 *   the close (the two packages, install, next steps); the site footer.
 * Words stay in pages/index.mdx; the parts here are layout and the small live pieces only the landing needs.
 */
import { Children, isValidElement, type ReactNode } from "react";
import { ArrowRightIcon, GithubLogoIcon } from "@phosphor-icons/react";
import { QuickstartApp } from "../../live";
import { REPO_URL } from "../../site/config";
import { Lattice } from "../brand";
import { island } from "../island";
import { Code, Install, Tab, Tabs } from "../mdx";
import { KeysDemo as KeysDemoPart, LinkDemo as LinkDemoPart } from "./demos";
import noteCode from "../../samples/concepts/quickstart/note-open-beside.tsx?raw";
import workspaceCode from "../../samples/concepts/quickstart/workspace.ts?raw";
import mainCode from "../../samples/concepts/quickstart/main.tsx?raw";

export { SiteFooter } from "./SiteFooter";

// ---------- the opening ----------

export function Opening({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children?: ReactNode;
}) {
  return (
    <header className="landing-opening" data-toc-skip="" data-enter="">
      <div className="landing-backdrop" aria-hidden>
        <Lattice className="landing-backdrop-mark" />
      </div>
      <div className="landing-opening-text">
        <h1 className="landing-title" id="landing-title">
          {title}
        </h1>
        <p className="landing-sub">{lead}</p>
      </div>
      <div className="landing-opening-actions">
        <Install packages="jali" />
        <div className="landing-buttons landing-buttons-hero">
          <a className="button button-primary" href="/get-started/quickstart">
            Start the quickstart
            <ArrowRightIcon aria-hidden size={16} />
          </a>
          <a className="button button-quiet" href={REPO_URL} target="_blank" rel="noreferrer">
            <GithubLogoIcon aria-hidden size={16} weight="fill" />
            View the source
          </a>
        </div>
      </div>
      {children}
    </header>
  );
}

/** The hero demo: nearly the full width of the window, with a small gutter. */
export function Stage({ children }: { children?: ReactNode }) {
  return <div className="landing-stage">{children}</div>;
}

// ---------- sections ----------

export function Section({
  id,
  label,
  title,
  lead,
  children,
}: {
  id: string;
  label: string;
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <section className="landing-section" id={id} aria-labelledby={`${id}-title`} data-toc-skip="">
      <header className="landing-section-head">
        <p className="landing-label">{label}</p>
        <h2 className="landing-section-title" id={`${id}-title`}>
          {title}
        </h2>
        {lead ? <p className="landing-lead">{lead}</p> : null}
      </header>
      {children}
    </section>
  );
}

// ---------- the whole app beside what it renders ----------

export function MinimalApp() {
  return (
    <div className="landing-split">
      <div className="landing-code">
        <Tabs>
          <Tab label="note.tsx">
            <Code code={noteCode} lang="tsx" />
          </Tab>
          <Tab label="workspace.ts">
            <Code code={workspaceCode} lang="ts" />
          </Tab>
          <Tab label="main.tsx">
            <Code code={mainCode} lang="tsx" />
          </Tab>
        </Tabs>
      </div>
      <div className="landing-result">
        <QuickstartApp height="100%" />
      </div>
    </div>
  );
}

// ---------- the four reasons, live, on one path ----------

export function Path({ children }: { children?: ReactNode }) {
  const steps = Children.toArray(children).filter(isValidElement);
  return <ol className="landing-path">{steps}</ol>;
}

export function Proof({
  id,
  title,
  href,
  more,
  demo,
  children,
}: {
  id: string;
  title: string;
  href: string;
  more: string;
  demo: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="landing-proof" id={id}>
      <div className="landing-proof-text">
        <h3 className="landing-proof-title">{title}</h3>
        <div className="landing-proof-body">{children}</div>
        <a className="landing-more" href={href}>
          {more}
          <ArrowRightIcon aria-hidden size={15} />
        </a>
      </div>
      <div className="landing-proof-demo">{demo}</div>
    </li>
  );
}

/** The link: a customer beside their notes, under the address the workspace writes. An island. */
export const LinkDemo = island("LinkDemo", LinkDemoPart);
/** The keys: a customer beside a stack of tabs, with the keys read from its keymap. An island. */
export const KeysDemo = island("KeysDemo", KeysDemoPart);

// ---------- the close ----------

export function Close({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children?: ReactNode;
}) {
  return (
    <section
      className="landing-close"
      id="install"
      aria-labelledby="install-title"
      data-toc-skip=""
    >
      <div className="landing-close-head">
        <h2 className="landing-close-title" id="install-title">
          {title}
        </h2>
        <p className="landing-lead">{lead}</p>
        <Install packages="jali" />
        <div className="landing-buttons">
          <a className="button button-primary" href="/get-started/quickstart">
            Start the quickstart
            <ArrowRightIcon aria-hidden size={16} />
          </a>
          <a className="button button-quiet" href="/get-started/key-concepts">
            Read the key concepts
          </a>
        </div>
      </div>
      <div className="landing-close-body">{children}</div>
    </section>
  );
}

export function Package({
  name,
  href,
  exports,
  children,
}: {
  name: string;
  href: string;
  exports: string;
  children?: ReactNode;
}) {
  return (
    <div className="landing-package">
      <h3 className="landing-package-name">
        <a className="landing-package-link" href={href}>
          {name}
        </a>
      </h3>
      <div className="landing-package-text">{children}</div>
      <p className="landing-package-exports">
        {exports.split(",").map((e) => (
          <code key={e}>{e.trim()}</code>
        ))}
      </p>
    </div>
  );
}
export function Theming({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <div className="landing-theming">
      <div className="landing-theming-text">{children}</div>
      <a className="landing-more" href={href}>
        Theming
        <ArrowRightIcon aria-hidden size={15} />
      </a>
    </div>
  );
}
