/**
 * The landing page at "/": its own place, apart from the docs. One story, top to bottom:
 *   the opening (what Jali is, install, the two actions) over the live workspace;
 *   the whole quickstart app beside what it renders;
 *   the four reasons, each live, on one numbered path;
 *   the close (install, next steps, and the package's entries as a pane); the site footer.
 * Words stay in src/docs/index.mdx; the parts here are its layout, and its three live demos (./demos), each an island.
 * The page around it (its frame and the site footer) is the landing layout (src/shell/Shell.tsx).
 */
import { Children, isValidElement, type ReactNode } from "react";
import { ArrowRightIcon, GithubLogoIcon } from "@phosphor-icons/react";
import { QuickstartApp } from "../live";
import { REPO_URL } from "../site/config";
import { island } from "../shell/island";
import { Code, CodeBody, Install, Tab, Tabs } from "../shell/mdx";
import { FollowDemo as FollowDemoPart } from "./demos/FollowDemo";
import { KeysDemo as KeysDemoPart } from "./demos/KeysDemo";
import { LinkDemo as LinkDemoPart } from "./demos/LinkDemo";
import noteCode from "../samples/concepts/quickstart/note-open-beside.tsx?raw";
import jaliCode from "../samples/concepts/quickstart/jali.ts?raw";
import mainCode from "../samples/concepts/quickstart/main.tsx?raw";

// ---------- the opening ----------

export function Opening({ title, lead }: { title: string; lead: string }) {
  return (
    <header className="landing-opening" data-enter="">
      {/* A layout's dividers behind the opening: the centre is clear for the words, the sides split into tiles. */}
      <div className="landing-backdrop" aria-hidden>
        <span className="hero-tile hero-tile-top" />
        <span className="hero-tile hero-tile-bottom" />
        <span className="hero-divider hero-divider-left" />
        <span className="hero-divider hero-divider-right" />
        <span className="hero-split hero-split-top" />
        <span className="hero-split hero-split-bottom" />
        <span className="hero-split hero-split-base" />
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
    <section className="landing-section" id={id} aria-labelledby={`${id}-title`}>
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
          <Tab label="jali.ts">
            <Code code={jaliCode} lang="ts" />
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
/** Following: a list, its following detail, and a line that says whether it follows or is kept. An island. */
export const FollowDemo = island("FollowDemo", FollowDemoPart);
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
    <section className="landing-close" id="install" aria-labelledby="install-title">
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

/**
 * The package, as a pane: its name and what it needs in the title bar, then one row per entry, each the line that
 * imports it (highlighted as code) beside what it gives you and a link to more.
 */
export function Imports({ children }: { children?: ReactNode }) {
  return (
    <div className="landing-imports">
      <div className="landing-imports-bar">
        <span className="landing-imports-name">jali</span>
        <span className="landing-imports-note">No dependencies. jali/react needs React 18.2+.</span>
      </div>
      <ul className="landing-imports-list">{children}</ul>
    </div>
  );
}
export function Import({
  code,
  href,
  more,
  children,
}: {
  code: string;
  href: string;
  more: string;
  children?: ReactNode;
}) {
  return (
    <li className="landing-import">
      <div className="landing-import-code">
        <CodeBody code={code} lang="ts" numbers={false} />
      </div>
      <div className="landing-import-text">{children}</div>
      <a className="landing-more landing-import-more" href={href}>
        {more}
        <ArrowRightIcon aria-hidden size={15} />
      </a>
    </li>
  );
}
