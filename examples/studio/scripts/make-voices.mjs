#!/usr/bin/env node
/**
 * Makes the demo sessions' speech: one clip per transcript segment, spoken by a macOS system voice (`say`), converted
 * to AAC in an .m4a file (`afconvert`), and the transcript's timings from the clips' real durations.
 *
 *   node examples/studio/scripts/make-voices.mjs
 *
 * macOS only. Writes `public/audio/<session>/<segment>.m4a` and `src/sessions/generated.ts`; both are committed, so
 * the example runs without this script. The voices are a placeholder for the lab: replace them with properly licensed
 * recordings before the example is published.
 *
 * Timings:
 *  - segments sit end to end after a short intro, with a pause between them: their times are exact;
 *  - each word's time is interpolated across the voiced part of its clip by its length, then moved to the nearest
 *    pause in the clip's envelope when one is close. Good enough to highlight words as they play.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SESSIONS } from "./dialogue.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const AUDIO = join(root, "public", "audio");
const OUT = join(root, "src", "sessions", "generated.ts");

/** Seconds of music before the first word, between speakers, between two lines of one speaker, and after the last. */
const INTRO = 3.4;
const GAP_SWITCH = 0.55;
const GAP_SAME = 0.4;
const OUTRO = 4.6;
/** The envelope's rate: one peak per 20 ms. */
const PEAKS_PER_SECOND = 50;

const tmp = mkdtempSync(join(tmpdir(), "studio-voices-"));
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "inherit"] });

/** 16-bit little-endian PCM from a WAV file: its sample rate and samples in -1..1. */
function readWav(file) {
  const buf = readFileSync(file);
  let at = 12;
  let rate = 22050;
  let channels = 1;
  while (at < buf.length - 8) {
    const id = buf.toString("ascii", at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    if (id === "fmt ") {
      channels = buf.readUInt16LE(at + 10);
      rate = buf.readUInt32LE(at + 12);
    } else if (id === "data") {
      const n = Math.floor(size / 2 / channels);
      const samples = new Float32Array(n);
      for (let i = 0; i < n; i++) samples[i] = buf.readInt16LE(at + 8 + i * 2 * channels) / 32768;
      return { rate, samples };
    }
    at += 8 + size + (size % 2);
  }
  throw new Error(`no data in ${file}`);
}

/** The loudest sample in each 20 ms window. */
function envelope({ rate, samples }) {
  const win = Math.round(rate / PEAKS_PER_SECOND);
  const out = [];
  for (let i = 0; i < samples.length; i += win) {
    let m = 0;
    for (let j = i; j < Math.min(samples.length, i + win); j++) m = Math.max(m, Math.abs(samples[j]));
    out.push(m);
  }
  return out;
}

const round = (t) => Math.round(t * 1000) / 1000;

/** Word timings inside one clip, in seconds from the clip's start. */
function wordTimes(text, env) {
  const max = Math.max(...env, 1e-6);
  const loud = env.map((v) => v > max * 0.05);
  const first = Math.max(0, loud.indexOf(true));
  const last = Math.max(first + 1, loud.lastIndexOf(true) + 1);
  const t = (i) => i / PEAKS_PER_SECOND;
  // Pauses inside the voiced span: runs of two or more quiet windows.
  const gaps = [];
  for (let i = first; i < last; ) {
    if (env[i] < max * 0.07) {
      let j = i;
      while (j < last && env[j] < max * 0.07) j++;
      if (j - i >= 2) gaps.push({ at: t((i + j) / 2), long: j - i >= 4, used: false });
      i = j;
    } else i++;
  }
  const words = text.split(/\s+/).filter(Boolean);
  // A word's share: its letters, plus a little for the pause a comma or a full stop brings.
  const weight = (w) => w.replace(/[^\p{L}\p{N}]/gu, "").length + 1.5 + (/[,;:]$/.test(w) ? 3 : 0) + (/[.?!]$/.test(w) ? 5 : 0);
  const total = words.reduce((s, w) => s + weight(w), 0);
  const start = t(first);
  const span = t(last) - start;
  const cum = [0];
  for (const w of words) cum.push(cum.at(-1) + weight(w));
  const guess = cum.map((c) => start + (c / total) * span);
  // Anchors: the clip's ends, and each boundary after a comma or a full stop moved to the pause nearest it (the voice
  // stops there). Between two anchors, words share the time by their weight.
  const anchors = [[0, start]];
  words.forEach((w, i) => {
    if (i === words.length - 1 || !/[,;:.?!]$/.test(w)) return;
    const near = gaps
      .filter((g) => !g.used && g.long && g.at > anchors.at(-1)[1] + 0.1)
      .sort((a, b) => Math.abs(a.at - guess[i + 1]) - Math.abs(b.at - guess[i + 1]))[0];
    if (near && Math.abs(near.at - guess[i + 1]) < 0.4) {
      near.used = true;
      anchors.push([i + 1, near.at]);
    }
  });
  anchors.push([words.length, t(last)]);
  const bounds = [];
  for (let a = 0; a < anchors.length - 1; a++) {
    const [i0, t0] = anchors[a];
    const [i1, t1] = anchors[a + 1];
    for (let i = i0; i < i1; i++) bounds[i] = t0 + ((cum[i] - cum[i0]) / (cum[i1] - cum[i0])) * (t1 - t0);
  }
  bounds[words.length] = t(last);
  return { voiced: [start, t(last)], words: words.map((w, i) => [w, bounds[i], bounds[i + 1]]) };
}

const sessions = [];
for (const s of SESSIONS) {
  const dir = join(AUDIO, s.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  let at = INTRO;
  let prev = null;
  const segments = s.lines.map(([speakerId, text], i) => {
    const speaker = s.speakers.find((p) => p.id === speakerId);
    const id = `s${String(i + 1).padStart(2, "0")}`;
    const aiff = join(tmp, `${s.id}-${id}.aiff`);
    const wav = join(tmp, `${s.id}-${id}.wav`);
    run("say", ["-v", speaker.voice, "-r", String(speaker.rate), "-o", aiff, text]);
    run("afconvert", [aiff, "-f", "WAVE", "-d", "LEI16", wav]);
    run("afconvert", [aiff, "-f", "m4af", "-d", "aac", "-b", "40000", join(dir, `${id}.m4a`)]);
    const pcm = readWav(wav);
    const duration = pcm.samples.length / pcm.rate;
    const env = envelope(pcm);
    const timing = wordTimes(text, env);
    if (prev) at += prev === speakerId ? GAP_SAME : GAP_SWITCH;
    prev = speakerId;
    const start = at;
    at += duration;
    process.stdout.write(`${s.id} ${id} ${speaker.voice} ${duration.toFixed(2)}s\n`);
    return {
      id,
      speaker: speakerId,
      start: round(start),
      end: round(at),
      clip: `audio/${s.id}/${id}.m4a`,
      voiced: timing.voiced.map((v) => round(start + v)),
      text,
      words: timing.words.map(([w, a, b]) => [w, round(start + a), round(start + b)]),
      // 0 to 99, one a 20 ms window, relative to the clip's own start.
      peaks: env.map((v) => Math.min(99, Math.round(v * 99))),
    };
  });
  const lastEnd = segments.at(-1).end;
  sessions.push({
    id: s.id,
    show: s.show,
    episode: s.episode,
    title: s.title,
    recorded: s.recorded,
    music: s.music,
    speakers: s.speakers.map(({ id, name, role, voice }) => ({ id, name, role, voice })),
    intro: INTRO,
    outro: round(lastEnd + 0.8),
    duration: round(lastEnd + OUTRO),
    segments,
    markers: [
      { id: "m-intro", time: 0, label: "Intro" },
      ...s.markers.map(([i, label], n) => ({ id: `m${n + 1}`, time: segments[i].start, label })),
      { id: "m-outro", time: round(lastEnd + 0.8), label: "Outro" },
    ],
  });
}
rmSync(tmp, { recursive: true, force: true });

const header = `/**
 * Generated by scripts/make-voices.mjs from scripts/dialogue.mjs: do not edit by hand.
 * Segment times are exact (the clips' real durations); word times are interpolated.
 * The voices are macOS system voices, a placeholder for the lab: replace them before publishing.
 */
import type { SessionData } from "./types";

export const SESSIONS: SessionData[] = `;
writeFileSync(OUT, `${header}${JSON.stringify(sessions)};\n`);
process.stdout.write(`wrote ${OUT}\n`);
