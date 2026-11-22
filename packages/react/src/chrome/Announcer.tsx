import { useEffect, useState } from "react";
import { useStore } from "../state/react";

/**
 * One polite live region for every layout change. It hears each announcement as the store makes it, not only the
 * last of a render: messages said in one go (a close and the focus that follows) are read together, a repeat is
 * read again (the region clears, then speaks), and one said before it mounted is read once it does.
 */
export function Announcer() {
  const store = useStore();
  const [shown, setShown] = useState("");
  useEffect(() => {
    let { seq, text } = store.get().announcement;
    let pending: string[] = seq ? [text] : [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const speak = () => {
      setShown("");
      clearTimeout(timer);
      timer = setTimeout(() => {
        setShown(pending.join(" "));
        pending = [];
      }, 30);
    };
    if (pending.length) speak();
    const off = store.subscribe(() => {
      const a = store.get().announcement;
      if (a.seq === seq) return;
      ({ seq, text } = a);
      // The same words twice in one go are said once; at most the last few are kept.
      if (!pending.includes(text)) pending = [...pending, text].slice(-3);
      speak();
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [store]);
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
