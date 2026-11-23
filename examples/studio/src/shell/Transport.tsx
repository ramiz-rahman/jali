/**
 * The transport is the app's, not a pane's: a device of its own on the desk, always in reach, driving the one
 * playhead every pane follows. A display with the time, the transport keys in a pocket, and a jog wheel to scrub and
 * a speed selector in a second pocket.
 */
import { runCommand } from "jali";
import { useJali } from "jali/react";
import { SPEEDS } from "../audio/engine";
import { usePosition, useTransport, useTransportSession } from "../audio/react";
import { useServices } from "../services";
import { catalogueOf } from "../sessions/catalog";
import { clock, clockTenths, missionTime } from "../sessions/format";
import type { KeyProps } from "../ui/atoms/Key";
import { Glyph, type TransportGlyph } from "../ui/atoms/glyphs";
import { JogDial } from "../ui/molecules/dial/JogDial";
import { SelectorDial } from "../ui/molecules/dial/SelectorDial";
import { FaceKey } from "../ui/molecules/FaceKey";

/** The speed as the selector can show it: one of its detents, else 1×. */
const detent = (rate: number) => SPEEDS.find((s) => s === rate) ?? 1;

export function Transport() {
  const { engine } = useServices();
  const jali = useJali();
  const t = useTransport((s) => s);
  const session = useTransportSession();
  const pos = usePosition(false, 0.05);
  const mission = missionTime(session, pos);
  return (
    <div className="zone zone-player" role="group" aria-label="Transport">
      <div className="zone-row">
        {/* The display: glass bonded flush into its own cutout. Title and series on the first line, the clock and
          state on the second, the progress across the foot. */}
        <div className="cutout player-cutout">
          <div className="screen player-display">
            <div className="pd-line">
              {/* Loading and failure take the title's place, so the time row never has to make room for them. */}
              {t.status === "ready" ? (
                <span className="pd-title">{session.title}</span>
              ) : (
                <span className="pd-title pd-alert">
                  {t.status === "loading" ? "loading…" : "audio didn't load"}
                </span>
              )}
              {/* The mission clock where the session has one (Apollo's GET), else where it came from. */}
              <span className="pd-show">
                {mission ? `GET ${mission}` : catalogueOf(session).source}
              </span>
            </div>
            <div className="pd-time" aria-label={`${clock(pos)} of ${clock(session.duration)}`}>
              <span className="tp-now">{clockTenths(pos)}</span>
              <span className="pd-total">/ {clock(session.duration)}</span>
              <span className="pd-state" role="status">
                {t.status === "error" ? (
                  "✕"
                ) : (
                  <>
                    {t.playing ? "▶" : "■"}
                    <span className="pd-state-word"> {t.playing ? "play" : "stop"}</span>
                  </>
                )}
                <span className="pd-rate"> · {t.rate}×</span>
              </span>
            </div>
            <div className="pd-progress" aria-hidden>
              <span style={{ width: `${(pos / session.duration) * 100}%` }} />
            </div>
          </div>
        </div>
        <div className="pocket group-transport">
          <TransportKey
            glyph="back"
            legend="back"
            aria-label="Back 5 seconds"
            onClick={() => engine.skip(-5)}
          />
          <TransportKey
            glyph={t.playing ? "pause" : "play"}
            legend={t.playing ? "pause" : "play"}
            className="key-accent key-play"
            lamp
            data-on={t.playing ? "" : undefined}
            disabled={t.status !== "ready"}
            aria-label={t.playing ? "Pause" : "Play"}
            title={`${t.playing ? "Pause" : "Play"} (Space)`}
            onClick={() => engine.toggle()}
          />
          <TransportKey
            glyph="stop"
            legend="stop"
            className="tp-stop"
            aria-label="Stop"
            title="Stop, and go back to the start"
            onClick={() => engine.stop()}
          />
          {/* The name starts with the legend it shows, as ⌘K's does (WCAG 2.5.3: what is seen is part of what is said). */}
          <TransportKey
            glyph="forward"
            legend="fwd"
            aria-label="fwd: forward 5 seconds"
            title="Forward 5 seconds"
            onClick={() => engine.skip(5)}
          />
          <TransportKey
            glyph="loop"
            legend="loop"
            className="tp-loop"
            latched={!!t.loop}
            aria-label="Loop"
            title={
              t.loop
                ? `Looping ${clock(t.loop.start)} to ${clock(t.loop.end)}: press to stop`
                : "Loop the segment playing"
            }
            onClick={() => runCommand(jali, "studio.loop")}
          />
        </div>
        <div className="pocket group-rotary">
          <div className="face rotary tp-scrub">
            <JogDial
              label="Scrub"
              value={pos}
              min={0}
              max={session.duration}
              perTurn={10}
              valueText={`${clock(pos)} of ${clock(session.duration)}`}
              onChange={(v) => engine.scrub(v)}
              onTurn={(by) => engine.scrub(engine.position() + by)}
              className="rotary-control"
            />
            <span className="rotary-note" aria-hidden>
              10 s/turn
            </span>
            <span className="face-legend" aria-hidden>
              scrub
            </span>
          </div>
          <div className="face rotary tp-speed">
            <SelectorDial
              label="Speed"
              values={SPEEDS}
              value={detent(t.rate)}
              reset={1}
              format={(r) => `${r}×`}
              onChange={(r) => engine.setRate(r)}
              className="rotary-control"
            />
            <span className="rotary-note rotary-value" aria-hidden>
              {t.rate}×
            </span>
            <span className="face-legend" aria-hidden>
              speed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A transport key: its glyph, its legend, and its name for a screen reader, which is also its tooltip. */
function TransportKey({
  glyph,
  legend,
  className,
  ...key
}: KeyProps & { glyph: TransportGlyph; legend: string; "aria-label": string }) {
  return (
    <FaceKey
      className={className ? `transport-key ${className}` : "transport-key"}
      glyph={<Glyph name={glyph} />}
      legend={legend}
      title={key["aria-label"]}
      {...key}
    />
  );
}
