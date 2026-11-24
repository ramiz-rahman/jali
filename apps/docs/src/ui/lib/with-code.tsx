/** Text written with `code` spans in backticks (as the reference's and the examples' data write it), as React. */
import { Fragment, type ReactNode } from "react";

export function withCode(text: string): ReactNode[] {
  return text
    .split(/(`[^`]+`)/)
    .map((part, i) =>
      part.startsWith("`") ? (
        <code key={i}>{part.slice(1, -1)}</code>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
}
