/**
 * The key: every button in the app's own parts. A key never keeps focus after a click, so Space goes on playing and
 * pausing (shell/keys.ts); from the keyboard it is an ordinary button. A latching key (`latched` given) says whether
 * it is pressed and carries a lamp that lights with it.
 */
import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { Lamp } from "./Lamp";

/** A click doesn't move focus onto the control: for a control that isn't a key (the status line's credits). */
export const keepFocus = (e: MouseEvent) => e.preventDefault();

export type KeyProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** A latch: pressed or not. It draws the lamp and sets `aria-pressed`. */
  latched?: boolean;
  /** A lamp without a latch (the transport's play key, lit by its `data-on`). */
  lamp?: boolean;
};

export function Key({ latched, lamp, className, children, ...button }: KeyProps) {
  return (
    <button
      type="button"
      className={className ? `key ${className}` : "key"}
      aria-pressed={latched}
      onMouseDown={keepFocus}
      {...button}
    >
      {latched !== undefined || lamp ? <Lamp /> : null}
      {children}
    </button>
  );
}
