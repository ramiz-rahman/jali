/**
 * A key with a face: a glyph in the middle and its legend printed under it (the top bar, the launcher). When the key
 * has an `aria-label`, the printed legend is left to the eye.
 */
import type { ReactNode } from "react";
import { Key, type KeyProps } from "../atoms/Key";

export function FaceKey({
  glyph,
  legend,
  className,
  ...key
}: KeyProps & { glyph: ReactNode; legend: ReactNode }) {
  return (
    <Key className={className ? `face ${className}` : "face"} {...key}>
      {glyph}
      <span className="face-legend" aria-hidden={key["aria-label"] ? true : undefined}>
        {legend}
      </span>
    </Key>
  );
}
