import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ModalDialog } from "../a11y/ModalDialog";

interface Props<T> {
  /** The dialog's class (with `jali-palette`) and accessible name. */
  className: string;
  /** Which dialog it is, as `data-dialog` on `.jali-dialog`. */
  dialog: "palette" | "chooser";
  label: string;
  head?: ReactNode;
  placeholder: string;
  inputLabel?: string;
  /** Prefix of each option's DOM id, and the listbox's id and name. */
  idPrefix: string;
  listId: string;
  listLabel: string;
  items: T[];
  keyOf(item: T): string;
  matches(item: T, query: string): boolean;
  /** Orders the matches for a query, lowest first (equal ranks keep their order). Default: the items' order. */
  rank?(item: T, query: string): number;
  /** The option's class and content. */
  itemClass: string;
  render(item: T): ReactNode;
  itemProps?(item: T): Record<string, unknown>;
  disabled?(item: T): boolean;
  /** Enter chooses the selected item even when disabled (the command refuses itself); a click needs it enabled. */
  onChoose(item: T): void;
  onClose(): void;
  empty(query: string): ReactNode;
  /** The item selected when the dialog opens. Default: the first. */
  initial?: T;
}

/** A modal combobox over a filtered list: type to filter, arrows to move, Enter to choose, Escape to close. Focus
 *  goes to the field on open and back to where it was on close (ModalDialog). The selected option stays in view. */
export function ListDialog<T>(p: Props<T>) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(() => Math.max(0, p.initial ? p.items.indexOf(p.initial) : 0));
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    const found = p.items.filter((it) => !t || p.matches(it, t));
    if (!t || !p.rank) return found;
    const rank = p.rank;
    return found
      .map((it, n) => ({ it, n, r: rank(it, t) }))
      .sort((a, b) => a.r - b.r || a.n - b.n)
      .map((e) => e.it);
  }, [p.items, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = items[Math.min(i, items.length - 1)];
  // The selected option scrolls into the list's view, and only the list scrolls.
  useLayoutEffect(() => {
    const ul = list.current,
      li = ul?.querySelector('[aria-selected="true"]');
    if (!ul || !li) return;
    const r = li.getBoundingClientRect(),
      l = ul.getBoundingClientRect();
    if (r.top < l.top) ul.scrollTop -= l.top - r.top;
    else if (r.bottom > l.bottom) ul.scrollTop += r.bottom - l.bottom;
  }, [sel]);
  return (
    <ModalDialog
      scrim="jali-scrim"
      onClose={p.onClose}
      initialFocus={input}
      className={`jali-dialog jali-palette${p.className ? ` ${p.className}` : ""}`}
      data-dialog={p.dialog}
      role="dialog"
      aria-label={p.label}
    >
      {p.head}
      <input
        ref={input}
        className="jali-palette-input"
        placeholder={p.placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-label={p.inputLabel}
        aria-expanded="true"
        aria-controls={p.listId}
        aria-activedescendant={sel ? `${p.idPrefix}${p.keyOf(sel)}` : undefined}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setI(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setI((n) => Math.min(n + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setI((n) => Math.max(n - 1, 0));
          } else if (e.key === "Enter" && sel) {
            e.preventDefault();
            p.onChoose(sel);
          }
        }}
      />
      <ul
        ref={list}
        className="jali-palette-list"
        id={p.listId}
        role="listbox"
        aria-label={p.listLabel}
      >
        {items.map((it, n) => {
          const disabled = p.disabled?.(it) ?? false;
          const k = p.keyOf(it);
          return (
            <li
              key={k}
              id={`${p.idPrefix}${k}`}
              {...p.itemProps?.(it)}
              role="option"
              aria-selected={it === sel}
              aria-disabled={disabled || undefined}
              className={`${p.itemClass}${it === sel ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
              onPointerMove={() => setI(n)}
              onClick={() => !disabled && p.onChoose(it)}
            >
              {p.render(it)}
            </li>
          );
        })}
      </ul>
      {/* Nothing found: said as a status, outside the list (a listbox holds options only). Always there, so it is
          a live region before its words arrive. */}
      <div role="status" className={items.length ? undefined : "jali-palette-empty"}>
        {items.length ? null : p.empty(q)}
      </div>
    </ModalDialog>
  );
}
