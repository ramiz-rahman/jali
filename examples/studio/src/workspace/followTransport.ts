/**
 * In Studio the session being worked on is the one in the transport, whatever layout is open.
 *
 * A layout brings its own followers, showing the session they were built or left with, and Jali settles the
 * library's selection on what they show. So after a layout opens, the library works on the transport's session again
 * (`workOn`) and its followers come to it. A kept segment detail (Compare keeps one beside the one that follows) shows
 * a segment of the session the layout was designed on; on another session it would be a dead pane, so it takes this
 * session's first segment.
 */
import type { Jali } from "jali";
import type { Engine } from "../audio/engine";
import { clip } from "../panes/clip";
import { workOn } from "../panes/library";
import { sessionOf } from "../panes/refs";

/** Brings every layout opened from now on to the transport's session. Returns the stop. */
export function layoutsFollowTransport(jali: Jali, engine: Engine): () => void {
  let preset = jali.get().presetId;
  return jali.on("layout", () => {
    if (jali.get().presetId === preset) return;
    preset = jali.get().presetId;
    const { session } = engine.get();
    workOn(jali, engine, session);
    const first = engine.session().segments[0];
    if (!first) return;
    for (const p of jali.model().panes)
      if (p.ref.kind === clip.kind && !p.follows && sessionOf(p.ref) !== session)
        jali.actions.openHere(p.id, clip({ session, segment: first.id }));
  });
}
