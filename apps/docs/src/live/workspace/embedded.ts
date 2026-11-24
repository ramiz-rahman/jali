/**
 * What every workspace on a docs page shares, whichever way it is made: its own id (safe in DOM ids, the same on the
 * server and in the browser), storage in memory (never the reader's localStorage), only the keys pressed inside it,
 * so three workspaces on one page never all answer ⌘K or F6, and the site's own theme left alone.
 */
import { useId } from "react";
import { memoryStorage } from "jali-layout";

/** An id for one workspace, `prefix` and React's id for this place in the page. */
export function useEmbeddedId(prefix: string): string {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}

/** The options every embedded instance starts from (`createJali` or `createJaliStore`), with its id. */
export const embedded = (id: string) =>
  ({
    id,
    storage: memoryStorage(),
    keyboard: { scope: "local" },
    pageTheme: false,
  }) as const;
