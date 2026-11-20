/** A small client router: the address's path picks the page; links to the site's own pages navigate in place. */
import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { pages } from "./pages";

/** The path the page was prerendered for: what the server renders, and what hydration must match. */
export const InitialPath = createContext("/");

const listeners = new Set<() => void>();
const notify = () => {
  for (const l of listeners) l();
};
if (typeof window !== "undefined") window.addEventListener("popstate", notify);

export const currentPath = () =>
  typeof window === "undefined" ? "/" : window.location.pathname.replace(/\/$/, "") || "/";

export function navigate(to: string) {
  const { pathname, search, hash } = window.location;
  if (to === pathname + search + hash) return;
  window.history.pushState(null, "", to);
  notify();
  if (!to.includes("#")) window.scrollTo(0, 0);
}

export function usePath(): string {
  const initial = useContext(InitialPath);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    currentPath,
    () => initial,
  );
}

/**
 * Links to the site's own pages navigate without a reload. Everything else (the Markdown copies, the sitemap,
 * images, an address with no page) is left to the browser.
 */
export function useLinkInterception() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const a = (e.target as Element).closest?.("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      const path = url.pathname.replace(/\/$/, "") || "/";
      if (
        url.origin !== window.location.origin ||
        !pages[path] ||
        (url.pathname === window.location.pathname &&
          url.search === window.location.search &&
          url.hash)
      )
        return;
      e.preventDefault();
      navigate(path + url.search + url.hash);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
}
