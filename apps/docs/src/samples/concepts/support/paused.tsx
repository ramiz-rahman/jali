import { useEffect, useState } from "react";
import { definePane, type PaneProps } from "@jali/react";

// A live clock that stops while its pane is out of sight (behind a tab, tucked, folded or covered by a maximised pane).
function Clock({ paused }: PaneProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [paused]);
  return <time>{now.toLocaleTimeString()}</time>;
}

export const clock = definePane("clock", {
  title: "Clock",
  width: { min: 200 },
  height: { min: 120 },
  Component: Clock,
});
