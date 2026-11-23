/**
 * A change, shown three ways at once: its sign, an arrow and a colour. Colour is never the only signal, so the
 * direction reads in greyscale, to a colour-blind reader and to a screen reader ("up", "down").
 */
import type { ReactNode } from "react";
import { Arrow } from "../atoms/Arrow";
import { direction } from "../format";

export function Delta({ value, children }: { value: number; children: ReactNode }) {
  const dir = direction(value);
  return (
    <span className="delta" data-dir={dir}>
      <Arrow dir={dir} />
      <span className="sr-only">{dir === "flat" ? "unchanged" : dir}</span>
      {children}
    </span>
  );
}
