/** A lamp: the small LED that marks a latched key, a live pane, unsaved work or a clipping meter. Lit by `on`. */
import type { Ref } from "react";

export function Lamp({ on, ref }: { on?: boolean; ref?: Ref<HTMLSpanElement> }) {
  return <span ref={ref} className="led" data-on={on ? "" : undefined} aria-hidden />;
}
