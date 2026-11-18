import { useEffect, useState } from "react";
import { useUi } from "../state/react";

/** One polite live region for every layout change. Clears then sets, so a repeat is announced again. */
export function Announcer() {
  const { text, seq } = useUi((s) => s.announcement);
  const [shown, setShown] = useState("");
  useEffect(() => {
    if (!seq) return;
    setShown("");
    const t = setTimeout(() => setShown(text), 30);
    return () => clearTimeout(t);
  }, [text, seq]);
  return (
    <div
      className="jali-sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="announcer"
    >
      {shown}
    </div>
  );
}
