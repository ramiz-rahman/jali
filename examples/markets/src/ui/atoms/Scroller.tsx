/**
 * A box that scrolls on its own (a ladder, a tape, a table), reachable from the keyboard: Tab stops on it and the
 * arrow keys scroll it, so it isn't only for a mouse wheel. Its label names it as a region.
 */
import type { ReactNode } from "react";

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
