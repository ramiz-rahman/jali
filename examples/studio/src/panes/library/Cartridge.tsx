/**
 * A session as a cartridge: a paper label with the source and the title, a lamp; a window onto the tape (every
 * track's loudest at each moment); the running time, the track count and the licence printed on its foot. It is drawn
 * from the catalogue, so it shows before the session's data has loaded; only the tape's window waits for it.
 */
import { Suspense, useRef } from "react";
import { useFrame } from "../../audio/react";
import { useSessionEdits } from "../../model/react";
import { catalogueOf } from "../../sessions/catalog";
import { overviewOf } from "../../sessions/derive";
import { clock, spokenDuration } from "../../sessions/format";
import type { SessionId } from "../../sessions/ids";
import { useSession } from "../../sessions/load";
import { prepare, screenPalette, useSize } from "../../ui/lib/canvas";
import type { ListRow } from "../../ui/lib/listbox";
import { drawBars } from "../../ui/lib/waveform";

export function Cartridge({
  row,
  session,
  inTransport,
  live,
  paused,
  onSelect,
}: {
  /** Its part in the library's list (`useListbox`'s `row`). */
  row: ListRow;
  session: SessionId;
  inTransport: boolean;
  live: boolean;
  paused: boolean;
  onSelect: () => void;
}) {
  const mine = useSessionEdits(session);
  const corrected = Object.keys(mine?.corrections ?? {}).length;
  const notes = Object.keys(mine?.notes ?? {}).length;
  const cat = catalogueOf(session);
  return (
    <div
      {...row}
      data-live={live ? "" : undefined}
      className="lib-row"
      onClick={onSelect}
      // Named by what it shows (WCAG 2.5.3: the name contains the visible words); the running time spoken in full.
      aria-description={spokenDuration(cat.duration)}
    >
      <span className="lib-lamp" aria-hidden />
      <div className="lib-label">
        <span className="lib-show">{cat.source}</span>
        <b className="lib-title">{cat.title}</b>
      </div>
      <Suspense fallback={<div className="lib-wave screen" aria-hidden />}>
        <Tape session={session} paused={paused} inTransport={inTransport} />
      </Suspense>
      <div className="lib-meta">
        <span className="mono">{clock(cat.duration)}</span>
        <span className="dot lib-tracks" aria-hidden />
        <span className="lib-tracks">{cat.tracks} tracks</span>
        <span className="dot" aria-hidden />
        <span className="lib-licence" title={cat.licence.name}>
          {cat.licence.short}
        </span>
      </div>
      {live ? <span className="lib-live">playing</span> : null}
      {corrected || notes ? (
        <div className="lib-tags">
          {corrected ? <span className="tag">{corrected} corrected</span> : null}
          {notes ? (
            <span className="tag">
              {notes} {notes === 1 ? "note" : "notes"}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** The cartridge's window onto the tape; the session in the transport shows how far it has played. It suspends until
 *  the session's data has loaded, while the cartridge round it shows. */
function Tape({
  session: id,
  paused,
  inTransport,
}: {
  session: SessionId;
  paused: boolean;
  inTransport: boolean;
}) {
  const session = useSession(id);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { width, height } = useSize(box);
  useFrame(
    paused,
    (pos) => {
      const g = prepare(canvas.current, width, height);
      if (!g || !session) return;
      const c = screenPalette();
      drawBars(g, {
        envelope: overviewOf(session),
        box: { x: 0, y: 0, w: width, h: height },
        from: 0,
        to: session.duration,
        idle: c.idle,
        played: c.played,
        playedUntil: inTransport ? pos : -1,
      });
    },
    [width, height, inTransport, session],
  );
  return (
    <div ref={box} className="lib-wave screen" aria-hidden>
      <canvas ref={canvas} />
    </div>
  );
}
