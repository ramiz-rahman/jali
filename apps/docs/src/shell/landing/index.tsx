/**
 * The landing page at "/": its own place, apart from the docs. The live workspace is the opening; then the minimal
 * app beside what it renders, four things Jali does (each live), the two packages and a footer. Words stay in
 * pages/index.mdx where they can; the parts here are layout and the small live pieces only the landing needs.
 */
import { type ReactNode } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { PALETTE_ID, runCommand } from "@jali/core";
import { REPO_URL } from "../../site/config";
import { GitHubIcon, Lattice, Lockup } from "../brand";
import { Code, Install, Tab, Tabs } from "../mdx";
import { NotesWorkspace, useAddress, useNotesApp } from "./NotesWorkspace";
import noteCode from "../../samples/concepts/quickstart/note-open-beside.tsx?raw";
import startCode from "../../samples/concepts/quickstart/start.ts?raw";
import storeCode from "../../samples/concepts/quickstart/store.ts?raw";
import mainCode from "../../samples/concepts/quickstart/main.tsx?raw";

// ---------- the opening ----------

export function Opening({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="landing-opening" data-toc-skip="">
      <div className="landing-backdrop" aria-hidden><Lattice className="landing-backdrop-mark" /></div>
      <div className="landing-opening-text">
        <h2 className="landing-title" id="landing-title">{title}</h2>
        <div className="landing-sub">{children}</div>
      </div>
      <div className="landing-opening-actions">
        <Install packages="@jali/core @jali/react" />
        <div className="landing-buttons">
          <a className="button button-primary" href="/get-started/quickstart">Get started<ArrowRight aria-hidden size={16} strokeWidth={2} /></a>
          <a className="button button-quiet" href={REPO_URL} target="_blank" rel="noreferrer"><GitHubIcon size={16} />View on GitHub</a>
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

export function Section({ id, label, title, children, lead }: { id: string; label: string; title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <section className="landing-section" aria-labelledby={`landing-${id}`} data-toc-skip="">
      <header className="landing-section-head">
        <p className="landing-label">{label}</p>
        <h2 className="landing-section-title" id={`landing-${id}`}>{title}</h2>
        {lead ? <p className="landing-lead">{lead}</p> : null}
      </header>
      {children}
    </section>
  );
}

// ---------- the minimal app beside what it renders ----------

export function MinimalApp() {
  const app = useNotesApp();
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
      <figure className="landing-result">
        <NotesWorkspace app={app} height="100%" label="The minimal app, running" />
        <figcaption className="landing-caption">
          That code, running. Press <em>Open the next note beside</em>, drag the gap, or close a note. The address is kept in memory here, so this page's own stays put.
        </figcaption>
      </figure>
    </div>
  );
}

// ---------- things Jali does ----------

export function Features({ children }: { children?: ReactNode }) {
  return <ol className="landing-features">{children}</ol>;
}

export function Feature({ title, href, more, children, demo }: { title: string; href: string; more: string; demo: ReactNode; children?: ReactNode }) {
  return (
    <li className="landing-feature">
      <div className="landing-feature-text">
        <h3 className="landing-feature-title">{title}</h3>
        <div className="landing-feature-body">{children}</div>
        <a className="landing-more" href={href}>{more}<ArrowRight aria-hidden size={15} strokeWidth={1.75} /></a>
      </div>
      <div className="landing-feature-demo">{demo}</div>
    </li>
  );
}

/** The layout in the link: the notes app with the address it writes shown above it. */
export function LinkDemo() {
  const app = useNotesApp();
  const { search, entries } = useAddress(app);
  return (
    <figure className="landing-link-demo">
      <div className="landing-address" aria-live="polite" aria-label="The address this workspace writes">
        <span className="landing-address-dots" aria-hidden><i /><i /><i /></span>
        <code className="landing-address-url"><span>your-app.example/notes</span>{decodeURIComponent(search) || "?"}</code>
        <span className="landing-address-count">{entries} {entries === 1 ? "entry" : "entries"} in history</span>
      </div>
      <NotesWorkspace app={app} height={300} label="A workspace that writes its layout into the address" />
    </figure>
  );
}

const KEYS: { id: string; text: string }[] = [
  { id: PALETTE_ID, text: "Command palette" },
  { id: "pane.focus.next", text: "Next pane" },
  { id: "pane.tuck", text: "Tuck the pane away" },
  { id: "pane.zoom", text: "Maximise the pane" },
  { id: "pane.close", text: "Close the pane" },
  { id: "pane.undo_close", text: "Bring it back" },
];

/** Keyboard first: the workspace and its keys, read from the store's keymap. A key can also be clicked. */
export function KeysDemo() {
  const app = useNotesApp();
  const run = (id: string) => {
    if (id === PALETTE_ID) app.store.set({ paletteOpen: true });
    else runCommand(app.store, id);
  };
  return (
    <figure className="landing-keys-demo">
      <NotesWorkspace app={app} height={300} label="A workspace to try the keys in" />
      <ul className="landing-keys" aria-label="Keys, from this workspace's keymap">
        {KEYS.map((k) => (
          <li key={k.id}>
            <button type="button" className="landing-key" onClick={() => run(k.id)}>
              <kbd className="kbd">{app.store.keymap.label(k.id)}</kbd>
              <span>{k.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </figure>
  );
}

// ---------- packages ----------

export function Packages({ children }: { children?: ReactNode }) {
  return <div className="landing-packages">{children}</div>;
}
export function Package({ name, href, children, exports }: { name: string; href: string; exports: string; children?: ReactNode }) {
  return (
    <div className="landing-package">
      <h3 className="landing-package-name"><a className="landing-package-link" href={href}>{name}</a></h3>
      <div className="landing-package-text">{children}</div>
      <p className="landing-package-exports">{exports.split(",").map((e) => <code key={e}>{e.trim()}</code>)}</p>
    </div>
  );
}
export function Theming({ href, children }: { href: string; children?: ReactNode }) {
  return <div className="landing-theming"><div>{children}</div><a className="landing-more" href={href}>Theming<ArrowRight aria-hidden size={15} strokeWidth={1.75} /></a></div>;
}

// ---------- footer ----------

export function LandingFooter() {
  return (
    <footer className="landing-footer" data-toc-skip="">
      <Lattice className="landing-footer-lattice" />
      <div className="landing-footer-brand">
        <Lockup className="landing-footer-lockup" />
        <p>Workspaces of panes for React.</p>
      </div>
      <nav className="landing-footer-nav" aria-label="Site">
        <a href="/get-started/introduction">Docs</a>
        <a href="/reference/core">Reference</a>
        <a href="/examples">Examples</a>
        <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub<ArrowUpRight aria-hidden size={13} /></a>
      </nav>
      <p className="landing-footer-legal">Licence to be announced.</p>
    </footer>
  );
}
