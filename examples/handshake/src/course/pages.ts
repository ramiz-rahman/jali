/**
 * A lesson is its steps plus one more page, the self-check. These are the small rules about pages that the lesson
 * pane and the outline share: how many there are, which one a link means, where to pick up reading, and how far
 * through the course the person is.
 */
import { LESSONS } from "./lessons";
import { fraction, type Progress } from "./progress";
import type { Lesson } from "./types";

export const pagesOf = (lesson: Lesson) => lesson.steps.length + 1;

/** Whether `page` is the self-check, after the last step. */
export const isCheck = (lesson: Lesson, page: number) => page === lesson.steps.length;

/** A step number from a link, as a page that exists: 0 for anything unreadable, the last page for anything past it. */
export function clampStep(step: number, pages: number): number {
  return Number.isFinite(step) ? Math.min(Math.max(0, Math.floor(step)), pages - 1) : 0;
}

/** Where a lesson opens: the page the person was last on, never past the lesson. */
export function resume(progress: Progress, lesson: Lesson): number {
  return clampStep(progress[lesson.id]?.step ?? 0, pagesOf(lesson));
}

/** The pages of a lesson the person has reached, never more than it has. */
export const pagesRead = (progress: Progress, lesson: Lesson) =>
  Math.min(progress[lesson.id]?.reached ?? 0, pagesOf(lesson));

/** The lesson to start on: the first one not yet finished, else the first. */
export function firstOpen(progress: Progress): Lesson | undefined {
  return LESSONS.find((l) => fraction(progress, l.id, pagesOf(l)) < 1) ?? LESSONS[0];
}

/** 0 to 100: the share of the whole course's pages the person has reached. */
export function coursePercent(progress: Progress): number {
  const total = LESSONS.reduce((n, l) => n + pagesOf(l), 0);
  const read = LESSONS.reduce((n, l) => n + pagesRead(progress, l), 0);
  return total ? Math.round((read / total) * 100) : 0;
}
