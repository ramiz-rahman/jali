/**
 * Following playback: while the transport plays this session, the cursor (and so the segment detail that follows
 * it) moves with the line being spoken. It runs while the pane is hidden too, when its clock (`usePosition`) has
 * stopped: it is a few checks a second, not drawing.
 */
import { useEffect, useRef } from "react";
import { useServices } from "../../services";
import { segmentIndexAt } from "../../sessions/derive";
import type { SessionData } from "../../sessions/types";

export function useFollowPlayback(
  on: boolean,
  session: SessionData,
  cursor: { current: string; moveTo(id: string): void },
) {
  const { engine } = useServices();
  const latest = useRef(cursor);
  latest.current = cursor;
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => {
      const seg = session.segments[segmentIndexAt(session, engine.position())];
      if (seg && seg.id !== latest.current.current) latest.current.moveTo(seg.id);
    }, 200);
    return () => clearInterval(t);
  }, [on, session, engine]);
}
