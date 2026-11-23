import type { ReactNode } from "react";
import "./segmented.css";

/** A row of mutually exclusive buttons. */
export function Segmented<T extends string | number>({
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
          key={String(o.value)}
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
