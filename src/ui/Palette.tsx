import { useEffect, useMemo, useRef, useState } from "react";
import { COMMANDS, runCommand } from "./commands";
import { setState, useUi } from "./store";

/** ⌘K: every pane command. People see title, group and shortcut; the stable ID lives in data-command-id. */
export function Palette() {
  const open = useUi((s) => s.paletteOpen);
  if (!open) return null;
  return <PaletteDialog />;
}

function PaletteDialog() {
  useUi((s) => s.view);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const restore = useRef<Element | null>(document.activeElement);
  useEffect(() => {
    input.current?.focus();
    const back = restore.current;
    return () => (back as HTMLElement | null)?.focus?.({ preventScroll: true });
  }, []);
  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    return COMMANDS.filter((c) => !t || c.title.toLowerCase().includes(t) || c.id.includes(t) || c.group.toLowerCase().includes(t));
  }, [q]);
  const close = () => setState({ paletteOpen: false });
  const run = (id: string) => {
    close();
    // After the dialog unmounts and focus is back, so focus-dependent commands act on the pane.
    setTimeout(() => runCommand(id), 0);
  };
  const sel = items[Math.min(i, items.length - 1)];
  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Commands">
        <input
          ref={input}
          className="palette-input"
          placeholder="Type a command…"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={sel ? `cmd-${sel.id}` : undefined}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setI(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setI((n) => Math.min(n + 1, items.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setI((n) => Math.max(n - 1, 0)); }
            else if (e.key === "Enter" && sel) { e.preventDefault(); run(sel.id); }
            else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
          }}
        />
        <ul className="palette-list" id="palette-list" role="listbox" aria-label="Commands">
          {items.map((c, n) => {
            const disabled = c.enabled ? !c.enabled() : false;
            return (
              <li
                key={c.id}
                id={`cmd-${c.id}`}
                data-command-id={c.id}
                role="option"
                aria-selected={c === sel}
                aria-disabled={disabled || undefined}
                className={`palette-item${c === sel ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
                onPointerMove={() => setI(n)}
                onClick={() => !disabled && run(c.id)}
              >
                <span className="palette-title">{c.title}</span>
                <span className="palette-group">{c.group}</span>
                {c.keys ? <kbd>{c.keys}</kbd> : <span />}
              </li>
            );
          })}
          {!items.length ? <li className="palette-empty">No command matches “{q}”.</li> : null}
        </ul>
      </div>
    </div>
  );
}
