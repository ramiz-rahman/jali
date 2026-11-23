/**
 * The mixer's meters: a ladder of LED cells behind glass on the fader's scale, so a level reads against the fader
 * beside it. Pale up to −12 dB, amber to −3, signal orange above; the level falls back at 24 dB a second and the
 * peak holds for a second as one lit cell. The master's clip lamps light for two seconds after a peak within 0.5 dB
 * of full scale.
 *
 * Every meter is drawn in one loop while the mixer is on screen: each `<MeterBox>` and `<ClipLamp>` registers itself
 * with the mixer's loop (`useMeterLoop`), which reads the engine and draws them all each frame. It runs every frame
 * for every strip, so a frame allocates nothing: each meter's record is made once, and the palette is resolved once
 * per theme.
 */
import { createContext, useCallback, useContext, useRef } from "react";
import { useFrame } from "../../audio/react";
import { SILENCE_DB } from "../../levels";
import { clamp } from "../../numbers";
import { useServices } from "../../services";
import { Lamp } from "../../ui/atoms/Lamp";
import { prepare, screenPalette, type ScreenPalette } from "../../ui/lib/canvas";
import { dbToFader } from "../../ui/molecules/Fader";

/** The meters' middle zone, between the pale low cells and the orange top: the one colour added to the accent
 *  rules, and only for meters. */
const AMBER = "#f2b33d";
/** One LED cell's height, with a pixel between cells. */
const CELL = 3;

/** A meter's ballistics: the level as drawn, and the held peak. */
interface Meter {
  canvas: HTMLCanvasElement;
  level: number;
  hold: number;
  heldAt: number;
  clippedAt: number;
}

interface MeterLoop {
  /** By what the engine meters: a track id, or a side of the master (`MASTER_METERS`). */
  meters: Map<string, Meter>;
  lamps: Map<string, HTMLElement>;
}

const MeterLoopContext = createContext<MeterLoop | null>(null);
export const MeterLoopProvider = MeterLoopContext.Provider;

const useLoop = () => {
  const loop = useContext(MeterLoopContext);
  if (!loop) throw new Error("A meter needs the mixer's useMeterLoop above it");
  return loop;
};

/** The meters' loop: draws every registered meter while `paused` is false, and again when `redraw` changes. */
export function useMeterLoop(paused: boolean, redraw: unknown[]): MeterLoop {
  const { engine } = useServices();
  const loop = useRef<MeterLoop>({ meters: new Map(), lamps: new Map() }).current;
  const last = useRef(0);
  useFrame(
    paused,
    () => {
      const now = performance.now();
      const dt = Math.min(0.1, last.current ? (now - last.current) / 1000 : 0);
      last.current = now;
      const c = screenPalette();
      for (const [id, m] of loop.meters) {
        const peak = engine.meter(id);
        drawMeter(m, peak, now, dt, c);
        const lamp = loop.lamps.get(id);
        if (!lamp) continue;
        if (peak > -0.5) m.clippedAt = now;
        lamp.toggleAttribute("data-on", now - m.clippedAt < 2000);
      }
    },
    redraw,
  );
  return loop;
}

function drawMeter(m: Meter, peak: number, now: number, dt: number, c: ScreenPalette) {
  const box = m.canvas.parentElement;
  if (!box) return;
  const w = box.clientWidth;
  const h = box.clientHeight;
  const g = prepare(m.canvas, w, h);
  if (!g) return;
  m.level = Math.max(peak, m.level - 24 * dt);
  if (peak >= m.hold || now - m.heldAt > 1000) {
    m.hold = peak;
    m.heldAt = now;
  }
  const y = (db: number) => h - dbToFader(db) * h;
  const hot = y(-3);
  const warm = y(-12);
  const colour = (cy: number) => (cy < hot ? c.played : cy < warm ? AMBER : c.text);
  const top = m.level > SILENCE_DB + 1 ? y(m.level) : h + 1;
  for (let cy = h - CELL; cy >= 0; cy -= CELL + 1) {
    g.fillStyle = cy + CELL > top ? colour(cy) : c.line;
    g.fillRect(0, cy, w, CELL);
  }
  if (m.hold > SILENCE_DB + 1) {
    const hy = clamp(Math.round(y(m.hold)), 0, h - CELL);
    g.fillStyle = colour(hy);
    g.fillRect(0, hy, w, 2);
  }
}

/** One meter's glass: a track's, or one side of the master's. */
export function MeterBox({ id }: { id: string }) {
  const loop = useLoop();
  // Stable, so a re-render (a fader moved) keeps the meter's ballistics.
  const register = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (canvas)
        loop.meters.set(id, {
          canvas,
          level: SILENCE_DB,
          hold: SILENCE_DB,
          heldAt: 0,
          clippedAt: -1e9,
        });
      else loop.meters.delete(id);
    },
    [loop, id],
  );
  return (
    <div className="mx-meter" aria-hidden>
      <canvas ref={register} />
    </div>
  );
}

/** A clip lamp for the master's side `id`, lit by the loop. */
export function ClipLamp({ id, side }: { id: string; side: string }) {
  const loop = useLoop();
  const register = useCallback(
    (lamp: HTMLSpanElement | null) => {
      if (lamp) loop.lamps.set(id, lamp);
      else loop.lamps.delete(id);
    },
    [loop, id],
  );
  return (
    <span className="mx-clip" ref={register}>
      <Lamp />
      {side}
    </span>
  );
}
