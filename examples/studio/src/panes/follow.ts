/**
 * One library, followers of several kinds. The library selects a session's transcript (`transcript({ session })`),
 * so its following transcript shows it. The timeline, the mixer and the markers that follow it show the same session:
 * each kind's `follow` says what it shows for the selected transcript, and Jali moves them all together once the
 * selection rests.
 *
 * The transcript is a list too: it selects a segment (`clip({ session, segment })`), and the segment detail that
 * follows the transcript shows it.
 */
import type { ObjectRef } from "@jali/core";

/** A kind's `follow`: the selected object's session, if it names one. */
export const followSession = (selected: ObjectRef) =>
  typeof selected.params.session === "string" ? { session: selected.params.session } : undefined;
