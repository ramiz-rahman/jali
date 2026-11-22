import { useState } from "react";
import { useJaliCommands } from "jali/react";

/**
 * Jali's commands inside your app's own command menu. This is a plain list; with cmdk, each entry becomes a
 * <Command.Item> and `run` goes in `onSelect`. Render it inside <JaliRoot>, next to your app's own commands.
 */
export function HostCommandMenu({ onClose }: { onClose: () => void }) {
  const commands = useJaliCommands(); // the focused pane's own first, then the workspace's
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
      <ul role="listbox" aria-label="Commands">
        {shown.map((c) => (
          <li
            key={c.key}
            role="option"
            aria-selected={false}
            aria-disabled={c.disabled}
            title={c.reason}
          >
            <button
              disabled={c.disabled}
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
