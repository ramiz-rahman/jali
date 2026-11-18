/** A small client router: the address's path picks the page; links with `data-nav` or plain same-origin anchors navigate in place. */
import { useEffect, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const notify = () => {
  for (const l of listeners) l();
};
if (typeof window !== "undefined") window.addEventListener("popstate", notify);

export const currentPath = () =>
  typeof window === "undefined" ? "/" : window.location.pathname.replace(/\/$/, "") || "/";

export function navigate(to: string) {
  if (to === window.location.pathname + window.location.hash) return;
  window.history.pushState(null, "", to);
  notify();
  if (!to.includes("#")) window.scrollTo(0, 0);
}

export function usePath(): string {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    currentPath,
    () => "/",
  );
}

/** Same-origin links navigate without a reload. */
export function useLinkInterception() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const a = (e.target as Element).closest?.("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        (url.pathname === window.location.pathname && url.hash)
      )
        return;
      e.preventDefault();
      navigate(url.pathname + url.hash);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
}
