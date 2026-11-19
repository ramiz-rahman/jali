/**
 * The instrument picker: type a few letters of a symbol or a name, then Enter. "Open chart for…", "Add to
 * watchlist…" and / all open it. It renders outside the workspace (`<JaliRoot overlays>`), so Jali never pulls
 * focus out of it; on close, focus goes back to the pane that had it.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useMarket } from "../market/react";
import { useServices, type PickRequest } from "../services";
import { useStore } from "../store";

const CLASS = {
  equity: "Equity",
  govt: "Government",
  corp: "Corporate",
  fx: "FX",
  index: "Index",
} as const;

export function Picker() {
  const { picker } = useServices();
  const request = useStore(picker, (r) => r);
  return request ? <PickerDialog request={request} close={() => picker.set(null)} /> : null;
}

function PickerDialog({ request, close }: { request: PickRequest; close: () => void }) {
  const market = useMarket();
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [at, setAt] = useState(0);
  const back = useRef<Element | null>(document.activeElement);

  useEffect(() => {
    ref.current?.showModal();
    const returnTo = back.current;
    return () => (returnTo as HTMLElement | null)?.focus?.();
  }, []);

  const matches = useMemo(() => {
    const t = text.trim().toLowerCase();
    const pool = market.instruments.filter(
      (i) => !request.only || request.only.includes(i.assetClass),
    );
    if (!t) return pool.slice(0, 50);
    // Symbols that start with the text first, then names that contain it.
    const starts = pool.filter((i) => i.symbol.toLowerCase().startsWith(t));
    const names = pool.filter(
      (i) =>
        !starts.includes(i) &&
        (i.name.toLowerCase().includes(t) || i.symbol.toLowerCase().includes(t)),
    );
    return [...starts, ...names].slice(0, 50);
  }, [text, market, request.only]);
  const current = matches[Math.min(at, matches.length - 1)];

  const choose = (symbol: string) => {
    close();
    request.onPick(symbol);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") setAt((a) => Math.min(matches.length - 1, a + 1));
    else if (e.key === "ArrowUp") setAt((a) => Math.max(0, a - 1));
    else if (e.key === "Enter" && current) choose(current.symbol);
    else if (e.key === "Escape") close();
    else return;
    e.preventDefault();
    e.stopPropagation(); // the workspace never sees the picker's keys
  };

  return (
    <dialog
      ref={ref}
      className="picker"
      aria-labelledby="picker-title"
      onCancel={(e) => (e.preventDefault(), close())}
      onClick={(e) => e.target === ref.current && close()}
    >
      <h2 id="picker-title" className="sr-only">
        {request.title}
      </h2>
      <input
        className="picker-input"
        autoFocus
        value={text}
        placeholder={request.title}
        aria-label={request.title}
        role="combobox"
        aria-expanded
        aria-controls="picker-list"
        aria-activedescendant={current ? `pick-${current.symbol}` : undefined}
        onChange={(e) => {
          setText(e.target.value);
          setAt(0);
        }}
        onKeyDown={onKeyDown}
        spellCheck={false}
      />
      <ul id="picker-list" role="listbox" className="picker-list" aria-label="Instruments">
        {matches.map((i) => (
          <li
            key={i.symbol}
            id={`pick-${i.symbol}`}
            role="option"
            aria-selected={i === current}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(i.symbol)}
          >
            <b>{i.symbol}</b>
            <span className="picker-name">{i.name}</span>
            <span className="picker-class">{CLASS[i.assetClass]}</span>
          </li>
        ))}
        {!matches.length ? <li className="picker-none">Nothing matches "{text}"</li> : null}
      </ul>
      <p className="picker-foot">↑↓ to choose · Enter to open · Esc to close</p>
    </dialog>
  );
}
