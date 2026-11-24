/** The keys: a customer beside a stack of tabs, with the keys read from this workspace's keymap. */
import { PALETTE_ID, formatKeys, runCommand } from "jali/adapter";
import { NamedWorkspace, useHydrated } from "../../live/embed";
import { useShopDemo } from "./useShopDemo";

const KEYS: { id: string; text: string }[] = [
  { id: PALETTE_ID, text: "Command palette" },
  { id: "pane.focus.next", text: "Next pane" },
  { id: "pane.zoom", text: "Maximise" },
  { id: "pane.tuck", text: "Tuck away" },
  { id: "pane.close", text: "Close" },
  { id: "pane.undo_close", text: "Bring back" },
];

export function KeysDemo() {
  const { jali } = useShopDemo("stack");
  const run = (id: string) => {
    if (id === PALETTE_ID) jali.dialogs.openPalette();
    else runCommand(jali, id);
  };
  // The keymap reads the platform from `navigator`, which the build machine has too. Until the page hydrates, the
  // keys are written for Windows and Linux on every machine, so the prerender and hydration match; then for the
  // reader's own platform.
  const hydrated = useHydrated();
  const label = (id: string) => {
    if (hydrated) return jali.keymap.label(id);
    const seq = jali.keymap.sequences(id)[0];
    return seq ? formatKeys(seq, "other") : "";
  };
  return (
    <div className="landing-keys-demo">
      <NamedWorkspace
        jali={jali}
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
