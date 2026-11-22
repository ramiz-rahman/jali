/**
 * The transport in React. A pane passes Jali's `paused`: while it is behind a tab, folded, tucked or behind a
 * maximised pane, these stop reading the clock and drawing, and catch up at once when it shows again. The sound is
 * not theirs to stop: it lives in the engine.
 */
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@jali/react";
import { useServices } from "../services";
import { useStore } from "@jali-examples/shared/store";
import type { TransportState } from "./engine";

export function useTransport<T>(select: (s: TransportState) => T): T {
  return useStore(useServices().engine, select);
}

/** The playhead, rounded down to `step` seconds, re-read every frame while playing and on screen. */
export function usePosition(paused: boolean, step = 0.1): number {
  const { engine } = useServices();
  const playing = useTransport((s) => s.playing);
  const at = useTransport((s) => s.at);
  const session = useTransport((s) => s.session);
  const q = (t: number) => Math.floor(t / step + 1e-6) * step;
  const [pos, setPos] = useState(() => q(engine.position()));

  useEffect(() => {
    if (paused) return; // out of sight: keep what is shown
    setPos(q(engine.position()));
    if (!playing) return;
    let frame = requestAnimationFrame(function tick() {
      setPos(q(engine.position()));
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
    // q depends on step only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, paused, playing, at, session, step]);
  return pos;
}

/**
 * Calls `draw(position)` every frame while playing and on screen, and once whenever `deps` or the transport change.
 * For canvases: nothing re-renders. A change of theme draws again too, since the colours come from the tokens.
 */
export function useFrame(paused: boolean, draw: (position: number) => void, deps: unknown[]) {
  const { engine } = useServices();
  const theme = useTheme();
  const playing = useTransport((s) => s.playing);
  const at = useTransport((s) => s.at);
  const ref = useRef(draw);
  ref.current = draw;

  useEffect(() => {
    if (paused) return;
    ref.current(engine.position());
    // Once more on the next frame: a new theme reaches the page's attributes after this effect runs.
    const settle = requestAnimationFrame(() => ref.current(engine.position()));
    if (!playing) return () => cancelAnimationFrame(settle);
    let frame = requestAnimationFrame(function tick() {
      ref.current(engine.position());
      frame = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(settle);
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, paused, playing, at, theme, ...deps]);
}
