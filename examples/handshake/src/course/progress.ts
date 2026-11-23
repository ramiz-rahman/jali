/**
 * How far the person has read, kept in the browser. It is a convenience, not state anyone depends on: storage can
 * be missing, full or refused (private windows, blocked site data), and then the course simply starts fresh every
 * visit. Every read and write is guarded (store.ts `stored`).
 */
import { createStore, stored } from "#src/store.ts";

/** Per lesson: the step the person was last on, and how many steps they have reached (the furthest, plus one). */
export interface LessonProgress {
  step: number;
  reached: number;
}
export type Progress = Record<string, LessonProgress>;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** What was stored, kept only where it is the right shape: a corrupt entry is dropped, never thrown. */
export function parseProgress(raw: string | null): Progress {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const out: Progress = {};
    for (const [id, v] of Object.entries(parsed)) {
      if (!isRecord(v)) continue;
      const { step, reached } = v;
      if (typeof step === "number" && typeof reached === "number" && step >= 0 && reached >= 0) {
        out[id] = { step: Math.floor(step), reached: Math.floor(reached) };
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Record that the person is on `step` of a lesson. Returns the same object when nothing changes. */
export function visit(progress: Progress, id: string, step: number): Progress {
  const before = progress[id];
  const reached = Math.max(before?.reached ?? 0, step + 1);
  if (before && before.step === step && before.reached === reached) return progress;
  return { ...progress, [id]: { step, reached } };
}

/** 0 to 1: the share of a lesson's pages (its steps and its check) the person has reached. */
export function fraction(progress: Progress, id: string, pages: number): number {
  const reached = progress[id]?.reached ?? 0;
  return pages > 0 ? Math.min(1, reached / pages) : 0;
}

const saved = stored("handshake.course.progress", parseProgress);

/** The person's progress, loaded once from the browser and saved back on every change. */
export const progressStore = createStore<Progress>(saved.read());

export function recordVisit(id: string, step: number) {
  const next = visit(progressStore.get(), id, step);
  if (next === progressStore.get()) return;
  progressStore.set(next);
  saved.write(next);
}
