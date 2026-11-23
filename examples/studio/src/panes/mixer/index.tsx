/**
 * The mixer: one strip a track (fader, pan, mute, solo, a live meter) and the master (Strip.tsx). It works on the
 * real audio graph through the app's edits: a fader writes the session's mix, and the engine applies it, so the mix
 * holds whether the mixer is on screen, folded into a tab or tucked away. Only the meters stop (meters.tsx): they draw
 * while Jali says the pane is on screen, and the sound goes on regardless.
 *
 * While the transport plays its session, the mixer reports "live": the sound is going through it, even when it is
 * hidden, so its tab and shelf chip say so.
 */
import { useRef } from "react";
import { SlidersHorizontalIcon } from "@phosphor-icons/react";
import { useActivity } from "jali/react";
import { useServices } from "../../services";
import { useSize } from "../../ui/lib/canvas";
import { usePaneActions } from "../actions";
import { NotInTransport } from "../states";
import { defineSessionPane, type SessionPaneProps } from "../sessionPane";
import { MeterLoopProvider, useMeterLoop } from "./meters";
import { Master, Strip } from "./Strip";

function Mixer({ paused, view, transport }: SessionPaneProps) {
  const { engine } = useServices();
  const { session } = view;
  const desk = useRef<HTMLDivElement>(null);
  const { width, height } = useSize(desk);
  const meters = useMeterLoop(paused || !transport.inTransport, [width, height, engine.audio]);

  useActivity(transport.loading ? "loading" : transport.playing ? "live" : undefined);
  usePaneActions([
    { id: "reset", title: "Reset the mix", run: () => view.edit.resetMix() },
    { id: "unmute", title: "Unmute and unsolo every track", run: () => view.edit.clearMuteSolo() },
  ]);

  return (
    <div className="pane-body mixer">
      {!transport.inTransport ? <NotInTransport session={session.id} /> : null}
      <MeterLoopProvider value={meters}>
        <div
          ref={desk}
          className="mx-modules"
          role="group"
          aria-label={`Mixer for ${session.title}`}
          data-count={session.tracks.length}
        >
          {session.tracks.map((t) => (
            <Strip key={t.id} track={t} view={view} />
          ))}
          <Master view={view} />
        </div>
      </MeterLoopProvider>
    </div>
  );
}

export const mixer = defineSessionPane("mixer", {
  name: "Mixer",
  icon: SlidersHorizontalIcon,
  width: { min: 420, comfortable: 640 },
  height: { min: 340 },
  Body: Mixer,
});
