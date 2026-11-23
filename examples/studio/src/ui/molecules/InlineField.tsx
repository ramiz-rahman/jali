/** A name edited in place (a speaker, a marker): Enter or leaving the field keeps the text, Esc keeps the old name. */
import { useRef, useState } from "react";

export function InlineField({
  value,
  label,
  className,
  onDone,
}: {
  value: string;
  /** The field's accessible name. */
  label: string;
  className?: string;
  /** The text to keep, or `null` for Esc. Called once. */
  onDone(text: string | null): void;
}) {
  const [text, setText] = useState(value);
  const done = useRef(false);
  const finish = (v: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(v);
  };
  return (
    <input
      className={className}
      aria-label={label}
      value={text}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setText(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => finish(text)}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== "Escape") return;
        e.preventDefault();
        finish(e.key === "Enter" ? text : null);
      }}
    />
  );
}
