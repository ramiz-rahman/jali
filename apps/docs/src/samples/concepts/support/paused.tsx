import { useEffect, useState } from "react";
import { definePaneKind, type PaneComponentProps } from "@jali/react";

// A live clock that stops while its pane is out of sight (behind a tab, tucked, folded or covered by a maximised pane).
function Clock({ paused }: PaneComponentProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [paused]);
  return <time>{now.toLocaleTimeString()}</time>;
}

export const clock = definePaneKind({
  kind: "clock",
  title: () => "Clock",
  ref: (params) => ({ kind: "clock", params }),
  minWidth: 200,
  minHeight: 120,
  Component: Clock,
});
