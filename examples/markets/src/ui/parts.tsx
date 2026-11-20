/** Small parts the panes share. */
import { useRef, type ReactNode } from "react";
import { CaretDownIcon, CaretUpIcon, MinusIcon, QuestionIcon } from "@phosphor-icons/react";
import { useMarket } from "../market/react";
import type { Instrument } from "../market/types";
import { direction, type Direction } from "./format";

/**
 * A change, shown three ways at once: its sign, an arrow and a colour. Colour is never the only signal, so the
 * direction reads in greyscale, to a colour-blind reader and to a screen reader ("up", "down").
 */
export function Delta({
  value,
  children,
  className,
}: {
  value: number;
  children: ReactNode;
  className?: string;
}) {
  const dir = direction(value);
  return (
    <span className={`delta ${className ?? ""}`} data-dir={dir}>
      <Arrow dir={dir} />
      <span className="sr-only">{dir === "flat" ? "unchanged" : dir}</span>
      {children}
    </span>
  );
}

export function Arrow({ dir }: { dir: Direction }) {
  const Icon = dir === "up" ? CaretUpIcon : dir === "down" ? CaretDownIcon : MinusIcon;
  return <Icon className="arrow" size={10} weight={dir === "flat" ? "bold" : "fill"} aria-hidden />;
}

/**
 * A number that flashes when it ticks: green up, red down, for a moment. The flash restarts on every tick by
 * alternating between two identical animations. Under reduced motion there is no flash; the arrow beside the
 * price still says which way it went.
 */
export function Flash({
  value,
  dir,
  children,
}: {
  value: number;
  dir: 1 | -1 | 0;
  children: ReactNode;
}) {
  const seen = useRef({ value, n: 0, at: 0 });
  if (seen.current.value !== value) {
    // A price that ticks every moment (FX) flashes at most once a second, so a column of them stays calm.
    const now = Date.now();
    const flash = now - seen.current.at >= CALM_MS;
    seen.current = {
      value,
      n: seen.current.n + (flash ? 1 : 0),
      at: flash ? now : seen.current.at,
    };
  }
  const flash = seen.current.n === 0 ? undefined : dir > 0 ? "up" : dir < 0 ? "down" : undefined;
  return (
    <span className="flash" data-flash={flash} data-beat={seen.current.n % 2}>
      {children}
    </span>
  );
}

const CALM_MS = 1000;

/** Renders `children` for a known instrument, or says plainly that a link named one this market doesn't have. */
export function Known({
  symbol,
  children,
}: {
  symbol: string;
  children: (inst: Instrument) => ReactNode;
}) {
  const inst = useMarket().instrument(symbol);
  if (!inst)
    return (
      <Empty
        icon={<QuestionIcon size={20} aria-hidden />}
        title={`No instrument called ${symbol || "that"}`}
      >
        Pick one from a watchlist, or press / to search.
      </Empty>
    );
  return <>{children(inst)}</>;
}

export function Empty({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty" role="status">
      {icon}
      <p className="empty-title">{title}</p>
      {children ? <p className="empty-body">{children}</p> : null}
    </div>
  );
}

/**
 * A box that scrolls on its own (a ladder, a tape, a table), reachable from the keyboard: Tab stops on it and the
 * arrow keys scroll it, so it isn't only for a mouse wheel. Its label names it as a region.
 */
export function Scroller({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <div className={className} tabIndex={0} role="region" aria-label={label}>
      {children}
    </div>
  );
}

/** A row of mutually exclusive buttons (ranges, sides, tabs inside a pane). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: ReactNode; title?: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={`segmented ${className ?? ""}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Label and value pairs in a compact grid (the quote's figures). */
export function Figures({ rows }: { rows: readonly [label: string, value: ReactNode][] }) {
  return (
    <dl className="figures">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
