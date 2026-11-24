/** The controls in a tree panel's header: Sizes, a segmented switch, and Reset. */
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";

export function SizesToggle({ on, onChange }: { on: boolean; onChange(on: boolean): void }) {
  return (
    <button type="button" className="live-toggle" aria-pressed={on} onClick={() => onChange(!on)}>
      Sizes
    </button>
  );
}

export function Segmented<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: V; text: string }[];
  value: V;
  onChange(v: V): void;
}) {
  return (
    <span className="live-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.text}
        </button>
      ))}
    </span>
  );
}

export function ResetButton({ onReset }: { onReset(): void }) {
  return (
    <button
      type="button"
      className="live-icon-btn"
      aria-label="Reset the layout"
      title="Reset the layout"
      onClick={onReset}
    >
      <ArrowCounterClockwiseIcon size={14} aria-hidden />
    </button>
  );
}
