/**
 * Scrubbing is heard: each move of the hand plays a short grain of every track from where the playhead now is,
 * backwards when the hand moves back (a grain played backwards is a reversed copy of its samples). Grains overlap, so
 * a steady turn is a steady sound. Every grain plays as recorded, so the pitch stays put however fast the hand moves:
 * a fast turn skips more between grains.
 */
import type { Decoded, Graph } from "./graph";

/** A grain's length, in seconds. */
export const GRAIN = 0.09;

/** A grain of every track of `decoded` at `pos`, as recorded, backwards if `back`, into each track's strip. */
export function playGrain(graph: Graph, decoded: Decoded, pos: number, back: boolean) {
  const { ctx } = graph;
  if (ctx.state !== "running") return;
  const t = ctx.currentTime + 0.005;
  const from = back ? pos - GRAIN : pos;
  for (const [track, buffer] of decoded) {
    if (from < 0 || from + GRAIN > buffer.duration) continue;
    const src = ctx.createBufferSource();
    src.buffer = back ? reversed(ctx, buffer, from) : buffer;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.8, t + 0.02);
    env.gain.setValueAtTime(0.8, t + GRAIN - 0.03);
    env.gain.linearRampToValueAtTime(0, t + GRAIN);
    src.connect(env).connect(graph.input(track));
    if (back) src.start(t);
    else src.start(t, from, GRAIN);
    src.stop(t + GRAIN);
    src.onended = () => env.disconnect();
  }
}

/** One grain of `buffer` from `from`, its samples reversed. */
function reversed(ctx: AudioContext, buffer: AudioBuffer, from: number): AudioBuffer {
  const n = Math.floor(GRAIN * buffer.sampleRate);
  const start = Math.floor(from * buffer.sampleRate);
  const rev = ctx.createBuffer(buffer.numberOfChannels, n, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++)
    rev.getChannelData(ch).set(
      buffer
        .getChannelData(ch)
        .subarray(start, start + n)
        .reverse(),
    );
  return rev;
}
