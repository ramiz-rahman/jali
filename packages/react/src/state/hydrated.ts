/**
 * What the first render must agree on with a server's. A server can't know the reader's platform or browser, so
 * prerendered HTML prints keys for "other" and has no Pop out; hydration renders the same, then React renders again
 * with the browser's own values. A page rendered only in the browser (createRoot) gets them on its first render.
 */
import { useSyncExternalStore } from "react";
import { SERVER_PLATFORM, type Keymap } from "@jali/core/adapter";
import { useStore } from "./react";

const noSubscribe = () => () => {};

/** False on a server and while hydrating; true after, and on every render of a page rendered in the browser. */
export const useHydrated = (): boolean =>
  useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );

/** The instance's keymap for printing labels: the server's platform until the page has hydrated. */
export function useKeymap(): Keymap {
  const keymap = useStore().keymap;
  return useHydrated() ? keymap : keymap.forPlatform(SERVER_PLATFORM);
}
