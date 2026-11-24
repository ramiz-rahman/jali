/**
 * The landing's live demos of its own, beyond the live parts in src/live: a detail following its list, the link a
 * workspace writes, and the keys. Each is an island (wrapped in ./index.tsx), so this module is what the browser loads for them.
 */
import { useSyncExternalStore } from "react";
import { AnchorSimpleIcon, LinkSimpleHorizontalIcon } from "@phosphor-icons/react";
import type { Jali } from "jali";
import { formatKeys } from "jali/adapter";
import { PALETTE_ID, runCommand } from "jali/adapter";
import { useHydrated } from "../../live/ClientOnly";
import { LandingWorkspace, useAddress, useLandingApp } from "./NotesWorkspace";

/** What the order details of the list are doing, as one string, so React re-renders only when it changes. */
function followState(store: Jali): string {
  const panes = store.model().panes.filter((p) => p.linkedTo === "orders");
  const follower = panes.find((p) => p.follows);
  const kept = panes.find((p) => p.kept);
  return JSON.stringify({
    follower: follower && { id: follower.id, title: follower.title },
    kept: kept && { id: kept.id, title: kept.title },
  });
}

/**
 * Following: the orders, the order following them, and its customer following the order, under a line that says what
 * the order pane is doing (Following, or Kept), what to try, and the one button that changes it.
 */
export function FollowDemo() {
  const app = useLandingApp({ app: "demo", layout: "chain" });
  const { store } = app;
  const state = useSyncExternalStore(
    store.subscribe,
    () => followState(store),
    () => followState(store),
  );
  const { follower, kept } = JSON.parse(state) as {
    follower?: { id: string; title: string };
    kept?: { id: string; title: string };
  };
  const mode = follower && kept ? "both" : kept ? "kept" : follower ? "following" : "none";
  const text =
    mode === "following"
      ? `${follower!.title} shows the order selected in Orders. Pick another order: it changes in place, and its customer with it.`
      : mode === "kept"
        ? `${kept!.title} stays on its order. Open another order from the list, and it opens beside it to compare.`
        : mode === "both"
          ? `${kept!.title} is kept. ${follower!.title} follows the list: pick another order and only it changes.`
          : "Open an order from the list, and its detail follows the list.";
  const action =
    mode === "following"
      ? { label: `Keep ${follower!.title}`, run: () => store.actions.setKept(follower!.id, true) }
      : mode === "kept"
        ? { label: "Follow again", run: () => store.actions.setKept(kept!.id, false) }
        : mode === "both"
          ? {
              // Back to one detail that follows: the newer follower goes, and the kept one follows again. (Let go
              // beside a follower, Jali would keep that follower in its place instead, so there is one.)
              label: "Follow again",
              run: () => {
                store.actions.close(follower!.id);
                store.actions.setKept(kept!.id, false);
              },
            }
          : null;
  return (
    <div className="landing-follow-demo">
      <div className="landing-follow-bar" role="group" aria-label="What the order pane does">
        {/* The same marks as the toggle in the pane's header: a link while it follows, an anchor once kept. */}
        <span className="landing-follow-state" data-mode={mode}>
          {mode === "kept" || mode === "both" ? (
            <AnchorSimpleIcon aria-hidden size={14} weight="bold" />
          ) : (
            <LinkSimpleHorizontalIcon aria-hidden size={14} weight="bold" />
          )}
          {mode === "kept" ? "Kept" : mode === "both" ? "Kept and following" : "Following"}
        </span>
        <p className="landing-follow-text" aria-live="polite">
          {text}
        </p>
        {action ? (
          <button type="button" className="landing-follow-action" onClick={action.run}>
            {action.label}
          </button>
        ) : null}
      </div>
      <LandingWorkspace
        app={app}
        height={340}
        label="Orders, the order following them, and its customer following the order"
      />
    </div>
  );
}

/** The link: a customer beside their notes, under the address the workspace writes. */
export function LinkDemo() {
  const app = useLandingApp({ app: "demo", layout: "two" });
  const { search, entries } = useAddress(app);
  const query = decodeURIComponent(search);
  return (
    <div className="landing-link-demo">
      <div className="landing-address" role="group" aria-label="The address these panes write">
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
      <ul className="landing-keys" aria-label="Keys from this keymap; each can be clicked">
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
