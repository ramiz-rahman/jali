/**
 * The status line, bookended: what this is on the left ("Example app built with Jali"), who made it on the right.
 * Between them, Jali's shelf (tucked panes, as chips), the keys worth knowing (read from the keymap, so they are
 * right on every platform and after any rebinding) and the key to every credit and licence. The loaded session's
 * own credit is that key's tooltip; its licence is on its row in the library.
 */
import { Shelf, useJali, useJaliState } from "@jali/react";
import { BuiltWithJali, Maker } from "../../../shared/src/maker/maker";
import { show } from "../actions";
import { useTransport } from "../audio/react";
import { credits } from "../panes/credits";
import { catalogueOf } from "../sessions/catalog";

export function StatusLine() {
  const jali = useJali();
  const { keymap } = jali;
  const loaded = useTransport((s) => s.session);
  const cat = catalogueOf(loaded);
  const zoomed = useJaliState((s) => !!s.view.zoomed);
  // The keys worth knowing, each as a small cap and what it does.
  const keys: [key: string, does: string][] = zoomed
    ? [["Esc", "restore"]]
    : [
        ["Space", "play"],
        ["/", "go to segment"],
        [keymap.label("palette.toggle") ?? "", "commands"],
        [keymap.label("pane.focus.next") ?? "", "next pane"],
      ];
  return (
    <footer className="status" aria-label="Status">
      <BuiltWithJali />
      <Shelf />
      <span className="status-keys">
        {keys
          .filter(([key]) => key)
          .map(([key, does]) => (
            <span key={does} className="status-key">
              <kbd>{key}</kbd>
              {does}
            </span>
          ))}
      </span>
      <button
        type="button"
        className="status-credits"
        title={`${cat.short}\nPress for every credit and licence.`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => show(jali, credits())}
      >
        credits
      </button>
      <Maker />
    </footer>
  );
}
