import { useEffect, useState } from "react";
import { hooks } from "./store";

/** One polite live region for every layout change. Clears then sets so repeats are re-announced. */
export function Announcer() {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    hooks.announce = (m: string) => {
      setMsg("");
      clearTimeout(t);
      t = setTimeout(() => setMsg(m), 30);
    };
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="announcer">
      {msg}
    </div>
  );
}
