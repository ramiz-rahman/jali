/**
 * The person's changes in React: a session's edits, and the session with them applied (view.ts), kept up to date.
 */
import { useMemo } from "react";
import { useStore } from "@jali-examples/shared/store";
import { isSession } from "../sessions/ids";
import { useSession } from "../sessions/load";
import { useServices } from "../services";
import { editsOrNone, type SessionEdits } from "./edits";
import { viewOf, type SessionView } from "./view";

/** What the person has changed in session `id`, kept up to date; `undefined` for nothing yet. Needs no session data. */
export function useSessionEdits(id: string): SessionEdits | undefined {
  return useStore(useServices().edits, (all) => (isSession(id) ? all[id] : undefined));
}

/** The session with its edits, kept up to date. `undefined` for a session that doesn't exist; while its data loads,
 *  the component suspends (sessions/load.ts). */
export function useSessionView(id: string): SessionView | undefined {
  const { edits } = useServices();
  const session = useSession(id);
  const mine = useSessionEdits(id);
  return useMemo(
    () => (session ? viewOf(session, editsOrNone(mine), edits.session(session)) : undefined),
    [session, mine, edits],
  );
}
