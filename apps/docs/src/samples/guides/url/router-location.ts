import type { LocationPort } from "jali-layout";

/** What a router gives you: read the search string, go to a new one, and hear about changes. */
export interface RouterHooks {
  search(): string;
  navigate(search: string, replace: boolean): void;
  listen(onChange: () => void): () => void;
}

/**
 * A location port over a router. Jali expects `subscribe` to hear only changes it did not make (Back, Forward, a
 * router link). Most routers tell you about every navigation, Jali's own included, so this skips the one write Jali
 * is waiting for. Any other change of the search clears that wait: a write the router blocked or replaced never
 * swallows a later navigation, even one to the same address.
 */
export function routerLocation(router: RouterHooks): LocationPort {
  let mine: string | null = null; // the search Jali last asked for
  let last = router.search();
  return {
    search: () => router.search(),
    href: () => window.location.href,
    navigate(search, mode) {
      mine = search;
      router.navigate(search, mode === "replace");
    },
    subscribe(fn) {
      return router.listen(() => {
        const now = router.search();
        if (now === last) return; // something else changed (a loader finished), not the address
        last = now;
        const own = now === mine; // Jali's own write coming back
        mine = null; // either way, stop waiting: a blocked write must not hide a later visit
        if (!own) fn();
      });
    },
  };
}
