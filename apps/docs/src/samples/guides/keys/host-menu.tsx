import { useState, useSyncExternalStore } from "react";
import { listCommands } from "jali-layout";
import { useJali } from "jali-layout/react";

/**
 * Jali's commands inside your app's own command menu: a field and a list of buttons, which Tab and Enter reach with
 * no extra roles. With cmdk, each entry becomes a <Command.Item> and `run` goes in `onSelect`; cmdk then provides the
 * combobox's keys and roles. Render it inside <JaliRoot>, next to your app's own commands.
 */
export function HostCommandMenu({ onClose }: { onClose: () => void }) {
  const jali = useJali();
  // The focused pane's own first, then Jali's: the same array until something it lists changes. The same read is
  // the server's snapshot, so this renders on the server too.
  const read = () => listCommands(jali);
  const commands = useSyncExternalStore(jali.subscribe, read, read);
  const [query, setQuery] = useState("");
  const shown = commands.filter((c) =>
    `${c.title} ${c.group}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div role="dialog" aria-label="Commands">
      <input
        aria-label="Search commands"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul aria-label="Commands">
        {shown.map((c) => (
          <li key={c.key}>
            <button
              type="button"
              disabled={c.disabled}
              title={c.reason}
              onClick={() => {
                onClose(); // close first: some commands move focus into a pane
                c.run();
              }}
            >
              {c.title} <small>{c.group}</small> {c.keys ? <kbd>{c.keys}</kbd> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
