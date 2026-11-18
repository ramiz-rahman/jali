/**
 * The landing page at "/": its own place, apart from the docs. One story, top to bottom:
 *   the opening (what Jali is, four reasons that link to their proofs) over the live workspace;
 *   the whole quickstart app beside what it renders;
 *   the four reasons, each live, on one numbered path;
 *   the close (the two packages, install, next steps); the site footer.
 * Words stay in pages/index.mdx; the parts here are layout and the small live pieces only the landing needs.
 */
import { Children, isValidElement, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { PALETTE_ID, runCommand } from "@jali/core";
import { REPO_URL } from "../../site/config";
import { GitHubIcon, Lattice } from "../brand";
import { Code, Install, Tab, Tabs } from "../mdx";
import { LandingWorkspace, useAddress, useLandingApp } from "./NotesWorkspace";
import noteCode from "../../samples/concepts/quickstart/note-open-beside.tsx?raw";
import startCode from "../../samples/concepts/quickstart/start.ts?raw";
import storeCode from "../../samples/concepts/quickstart/store.ts?raw";
import mainCode from "../../samples/concepts/quickstart/main.tsx?raw";

export { SiteFooter } from "./SiteFooter";

// ---------- the opening ----------

export function Opening({ title, lead, children }: { title: string; lead: string; children?: ReactNode }) {
  return (
    <header className="landing-opening" data-toc-skip="" data-enter="">
      <div className="landing-backdrop" aria-hidden><Lattice className="landing-backdrop-mark" /></div>
      <div className="landing-opening-text">
        <h1 className="landing-title" id="landing-title">{title}</h1>
        <p className="landing-sub">{lead}</p>
      </div>
      <div className="landing-opening-actions">
        <Install packages="@jali/core @jali/react" />
        <div className="landing-buttons">
          <a className="button button-primary" href="/get-started/quickstart">Start the quickstart<ArrowRight aria-hidden size={16} strokeWidth={2} /></a>
          <a className="button button-quiet" href={REPO_URL} target="_blank" rel="noreferrer"><GitHubIcon size={16} />View the source</a>
        </div>
      </div>
      {children}
    </header>
  );
}

/** The four reasons, as an index: each links to its live proof further down. */
export function Reasons({ children }: { children?: ReactNode }) {
  return <ol className="landing-reasons" aria-label="What Jali does">{children}</ol>;
}
export function Reason({ href, children }: { href: string; children?: ReactNode }) {
  return <li><a className="landing-reason" href={href}><span className="landing-reason-text">{children}</span><ArrowRight aria-hidden size={14} strokeWidth={1.75} /></a></li>;
}

/** The hero demo: nearly the full width of the window, with a small gutter. */
export function Stage({ children }: { children?: ReactNode }) {
  return <div className="landing-stage">{children}</div>;
}

// ---------- sections ----------

export function Section({ id, label, title, lead, children }: { id: string; label: string; title: string; lead?: string; children?: ReactNode }) {
  return (
    <section className="landing-section" id={id} aria-labelledby={`${id}-title`} data-toc-skip="">
      <header className="landing-section-head">
        <p className="landing-label">{label}</p>
        <h2 className="landing-section-title" id={`${id}-title`}>{title}</h2>
        {lead ? <p className="landing-lead">{lead}</p> : null}
      </header>
      {children}
    </section>
  );
}

// ---------- the whole app beside what it renders ----------

export function MinimalApp() {
  const app = useLandingApp({ app: "quickstart" });
  return (
    <div className="landing-split">
      <div className="landing-code">
        <Tabs>
          <Tab label="note.tsx"><Code code={noteCode} lang="tsx" /></Tab>
          <Tab label="start.ts"><Code code={startCode} lang="ts" /></Tab>
          <Tab label="store.ts"><Code code={storeCode} lang="ts" /></Tab>
          <Tab label="main.tsx"><Code code={mainCode} lang="tsx" /></Tab>
        </Tabs>
      </div>
      <div className="landing-result">
        <LandingWorkspace app={app} height="100%" label="The quickstart app, running" />
      </div>
    </div>
  );
}

// ---------- the four reasons, live, on one path ----------

export function Path({ children }: { children?: ReactNode }) {
  const steps = Children.toArray(children).filter(isValidElement);
  return <ol className="landing-path">{steps}</ol>;
}

export function Proof({ id, title, href, more, demo, children }: { id: string; title: string; href: string; more: string; demo: ReactNode; children?: ReactNode }) {
  return (
    <li className="landing-proof" id={id}>
      <div className="landing-proof-text">
        <h3 className="landing-proof-title">{title}</h3>
        <div className="landing-proof-body">{children}</div>
        <a className="landing-more" href={href}>{more}<ArrowRight aria-hidden size={15} strokeWidth={1.75} /></a>
      </div>
      <div className="landing-proof-demo">{demo}</div>
    </li>
  );
}

/** The link: a customer beside their notes, under the address the workspace writes. */
export function LinkDemo() {
  const app = useLandingApp({ app: "demo", layout: "two" });
  const { search, entries } = useAddress(app);
  const query = decodeURIComponent(search);
  return (
    <div className="landing-link-demo">
      <div className="landing-address" role="group" aria-label="The address this workspace writes">
        <span className="landing-address-dots" aria-hidden><i /><i /><i /></span>
        <code className="landing-address-url" aria-live="polite"><span>localhost:5173/customers</span>{query || "?"}</code>
        <span className="landing-address-count">{entries} in history</span>
      </div>
      <LandingWorkspace app={app} height={340} label="A customer and their notes, writing the layout into the address" />
    </div>
  );
}

const KEYS: { id: string; text: string }[] = [
  { id: PALETTE_ID, text: "Command palette" },
  { id: "pane.focus.next", text: "Next pane" },
  { id: "pane.zoom", text: "Maximise" },
  { id: "pane.tuck", text: "Tuck away" },
  { id: "pane.close", text: "Close" },
  { id: "pane.undo_close", text: "Bring back" },
];

/** The keys: a customer beside a stack of tabs, with the keys read from this workspace's keymap. */
export function KeysDemo() {
  const app = useLandingApp({ app: "demo", layout: "stack" });
  const run = (id: string) => {
    if (id === PALETTE_ID) app.store.set({ paletteOpen: true });
    else runCommand(app.store, id);
  };
  return (
    <div className="landing-keys-demo">
      <LandingWorkspace app={app} height={340} label="A customer beside a stack of tabs, to try the keys in" />
      <ul className="landing-keys" aria-label="Keys from this workspace's keymap; each can be clicked">
        {KEYS.map((k) => (
          <li key={k.id}>
            <button type="button" className="landing-key" onClick={() => run(k.id)}>
              <kbd>{app.store.keymap.label(k.id)}</kbd>
              <span>{k.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- the close ----------

export function Close({ title, lead, children }: { title: string; lead: string; children?: ReactNode }) {
  return (
    <section className="landing-close" id="install" aria-labelledby="install-title" data-toc-skip="">
      <div className="landing-close-head">
        <h2 className="landing-close-title" id="install-title">{title}</h2>
        <p className="landing-lead">{lead}</p>
        <Install packages="@jali/core @jali/react" />
        <div className="landing-buttons">
          <a className="button button-primary" href="/get-started/quickstart">Start the quickstart<ArrowRight aria-hidden size={16} strokeWidth={2} /></a>
          <a className="button button-quiet" href="/get-started/key-concepts">Read the key concepts</a>
        </div>
      </div>
      <div className="landing-close-body">{children}</div>
    </section>
  );
}

export function Package({ name, href, exports, children }: { name: string; href: string; exports: string; children?: ReactNode }) {
  return (
    <div className="landing-package">
      <h3 className="landing-package-name"><a className="landing-package-link" href={href}>{name}</a></h3>
      <div className="landing-package-text">{children}</div>
      <p className="landing-package-exports">{exports.split(",").map((e) => <code key={e}>{e.trim()}</code>)}</p>
    </div>
  );
}
export function Theming({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <div className="landing-theming">
      <div className="landing-theming-text">{children}</div>
      <a className="landing-more" href={href}>Theming<ArrowRight aria-hidden size={15} strokeWidth={1.75} /></a>
    </div>
  );
}
