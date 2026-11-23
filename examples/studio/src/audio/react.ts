/**
 * The transport in React. A pane passes Jali's `paused`: while it is behind a tab, folded, tucked or behind a
 * maximised pane, these stop reading the clock and drawing, and catch up at once when it shows again. The sound is
 * not theirs to stop: it lives in the engine.
 */
import { useEffect, useRef, useState } from "react";
import { useJaliTheme } from "jali/react";
import { useStore } from "@jali-examples/shared/store";
import { useServices } from "../services";
import { sessionById } from "../sessions/load";
import type { SessionData } from "../sessions/types";
import type { Loop, TransportState } from "./engine";

export function useTransport<T>(select: (s: TransportState) => T): T {
  return useStore(useServices().engine, select);
}

/** The data of the session in the transport, kept up to date. */
export function useTransportSession(): SessionData {
  const id = useTransport((s) => s.session);
  // The transport only moves to a session whose data has loaded.
  return sessionById(id)!;
}

/** The transport as one session's pane sees it: everything is about that session, or off. */
export interface SessionTransport {
  /** The session is the transport's. */
  inTransport: boolean;
  playing: boolean;
  loading: boolean;
  /** The transport's loop, when it loops this session. */
  loop: Loop | null;
}

export function useSessionTransport(session: string): SessionTransport {
  const inTransport = useTransport((s) => s.session === session);
  const playing = useTransport((s) => s.session === session && s.playing);
  const loading = useTransport((s) => s.session === session && s.status === "loading");
  const loop = useTransport((s) => (s.session === session ? s.loop : null));
  return { inTransport, playing, loading, loop };
}

/** The playhead, rounded down to `step` seconds, re-read every frame while playing and on screen. */
export function usePosition(paused: boolean, step = 0.1): number {
  const { engine } = useServices();
  const playing = useTransport((s) => s.playing);
  const at = useTransport((s) => s.at);
  const session = useTransport((s) => s.session);
  const [pos, setPos] = useState(() => quantise(engine.position(), step));

  useEffect(() => {
    if (paused) return; // out of sight: keep what is shown
    const read = () => setPos(quantise(engine.position(), step));
    read();
    if (!playing) return;
    let frame = requestAnimationFrame(function tick() {
      read();
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [engine, paused, playing, at, session, step]);
  return pos;
}

const quantise = (t: number, step: number) => Math.floor(t / step + 1e-6) * step;

/**
 * Calls `draw(position)` every frame while playing and on screen, and once whenever `deps` or the transport change.
 * For canvases: nothing re-renders. A change of theme draws again too, since the colours come from the tokens.
 */
export function useFrame(paused: boolean, draw: (position: number) => void, deps: unknown[]) {
  const { engine } = useServices();
  const theme = useJaliTheme();
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
    // `deps` are the caller's: what its drawing reads besides the transport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, paused, playing, at, theme, ...deps]);
}
