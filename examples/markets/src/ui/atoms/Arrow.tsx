/** Which way a number went, as a caret: up, down, or a dash for unchanged. Decorative: words say it too (Delta). */
import { CaretDownIcon, CaretUpIcon, MinusIcon } from "@phosphor-icons/react";
import type { Direction } from "../format";

export function Arrow({ dir }: { dir: Direction }) {
  const Icon = dir === "up" ? CaretUpIcon : dir === "down" ? CaretDownIcon : MinusIcon;
  return <Icon className="arrow" size={10} weight={dir === "flat" ? "bold" : "fill"} aria-hidden />;
}
