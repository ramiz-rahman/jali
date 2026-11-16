import { useEffect, useMemo, useRef, useState } from "react";
import { Layers } from "lucide-react";
import { actions, findPane, mergeTargets, setState, stackOf, titleOf, useUi, type ChooserState } from "./store";
import { KindIcon } from "./PaneFrame";

/** ⌘K "Add to tabs of…" (⌥⌘T): pick a visible pane or stack by title; the focused pane joins it as a tab. */
export function Chooser() {
  const chooser = useUi((s) => s.chooser);
  if (!chooser) return null;
  return <ChooserDialog chooser={chooser} />;
}

function ChooserDialog({ chooser }: { chooser: ChooserState }) {
  useUi((s) => s.layout);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const restore = useRef<Element | null>(document.activeElement);
  useEffect(() => {
    input.current?.focus();
    const back = restore.current;
    return () => (back as HTMLElement | null)?.focus?.({ preventScroll: true });
  }, []);
  const all = useMemo(() => mergeTargets(chooser.source), [chooser.source]);
  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all.filter((m) => !t || m.label.toLowerCase().includes(t));
  }, [all, q]);
  const close = () => setState({ chooser: null });
  const choose = (target: string) => {
    close();
    // After the dialog unmounts and focus is back in the source pane.
    setTimeout(() => actions.mergeInto(chooser.source, target), 0);
  };
  const sel = items[Math.min(i, items.length - 1)];
  const title = titleOf(chooser.source);
  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="palette chooser" role="dialog" aria-modal="true" aria-label={`Add ${title} to tabs of`}>
        <div className="chooser-head">
          Add <b>{title}</b> to the tabs of…
        </div>
        <input
          ref={input}
          className="palette-input"
          placeholder="Pane or stack"
          role="combobox"
          aria-label="Pane or stack"
          aria-expanded="true"
          aria-controls="chooser-list"
          aria-activedescendant={sel ? `merge-${sel.id}` : undefined}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setI(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setI((n) => Math.min(n + 1, items.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setI((n) => Math.max(n - 1, 0)); }
            else if (e.key === "Enter" && sel) { e.preventDefault(); choose(sel.id); }
            else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
          }}
        />
        <ul className="palette-list" id="chooser-list" role="listbox" aria-label="Panes and stacks">
          {items.map((m, n) => {
            const stacked = !!stackOf(m.id);
            const kind = findPane(m.id)?.ref.kind ?? "";
            return (
              <li
                key={m.id}
                id={`merge-${m.id}`}
                role="option"
                aria-selected={m === sel}
                className={`palette-item chooser-item${m === sel ? " is-selected" : ""}`}
                onPointerMove={() => setI(n)}
                onClick={() => choose(m.id)}
              >
                <span className="chooser-icon" aria-hidden>
                  {stacked ? <Layers size={14} strokeWidth={1.5} /> : <KindIcon kind={kind} size={14} />}
                </span>
                <span className="palette-title">{m.label}</span>
                <span className="palette-id">{m.hint}</span>
              </li>
            );
          })}
          {!items.length ? <li className="palette-empty">No pane or stack matches “{q}”.</li> : null}
        </ul>
      </div>
    </div>
  );
}
