/**
 * What a ref (a pane's object, a list's selection) names, read once and typed. A ref's params come from links and
 * storage as plain values, so each is checked: a session must be one the library has.
 *
 * Every Studio ref but the library's and the credits' names a session; the segment detail's also names a segment
 * (`clipOf`, beside its kind in clip/).
 */
import type { ObjectRef } from "jali-layout";
import { isSession, type SessionId } from "../sessions/ids";

/** The session `ref` names, if it names one in the library. */
export function sessionOf(ref: ObjectRef | undefined): SessionId | undefined {
  const session = ref?.params.session;
  return isSession(session) ? session : undefined;
}

/** The library's kind. Its ref is made here, not by the library's definition, so a pane can offer "show the library"
 *  without importing the library, which itself links to every other kind (and an import cycle would leave a kind
 *  undefined while the others are made). */
export const LIBRARY_KIND = "library";

/** The library, as a ref to open. */
export const libraryRef = (): ObjectRef => ({ kind: LIBRARY_KIND, params: {} });
