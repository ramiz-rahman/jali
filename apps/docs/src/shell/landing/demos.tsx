/**
 * The landing's two live demos of its own, beyond the live parts in src/live: the link a workspace writes, and the
 * keys. Each is an island (wrapped in ./index.tsx), so this module is what the browser loads for them.
 */
import { formatKeys } from "@jali/core";
import { PALETTE_ID, runCommand } from "@jali/core/adapter";
import { useHydrated } from "../../live/ClientOnly";
import { LandingWorkspace, useAddress, useLandingApp } from "./NotesWorkspace";

/** The link: a customer beside their notes, under the address the workspace writes. */
export function LinkDemo() {
  const app = useLandingApp({ app: "demo", layout: "two" });
  const { search, entries } = useAddress(app);
  const query = decodeURIComponent(search);
  return (
    <div className="landing-link-demo">
      <div className="landing-address" role="group" aria-label="The address this workspace writes">
        <span className="landing-address-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <code className="landing-address-url" aria-live="polite">
          <span>localhost:5173/customers</span>
          {query || "?"}
        </code>
        <span className="landing-address-count">{entries} in history</span>
      </div>
      <LandingWorkspace
        app={app}
        height={340}
        label="A customer and their notes, writing the layout into the address"
      />
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
    if (id === PALETTE_ID) app.store.dialogs.openPalette();
    else runCommand(app.store, id);
  };
  // The keymap reads the platform from `navigator`, which the build machine has too. Until the page hydrates, the
  // keys are written for Windows and Linux on every machine, so the prerender and hydration match; then for the
  // reader's own platform.
  const hydrated = useHydrated();
  const label = (id: string) => {
    if (hydrated) return app.store.keymap.label(id);
    const seq = app.store.keymap.sequences(id)[0];
    return seq ? formatKeys(seq, "other") : "";
  };
  return (
    <div className="landing-keys-demo">
      <LandingWorkspace
        app={app}
        height={340}
        label="A customer beside a stack of tabs, to try the keys in"
      />
      <ul
        className="landing-keys"
        aria-label="Keys from this workspace's keymap; each can be clicked"
      >
        {KEYS.map((k) => (
          <li key={k.id}>
            <button type="button" className="landing-key" onClick={() => run(k.id)}>
              <kbd>{label(k.id)}</kbd>
              <span>{k.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
