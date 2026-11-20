/**
 * Checks for what comes back from storage. The plan (`trip/plan.ts`, `readPlan`) and each pane's own state
 * (`usePaneState`'s `parse`) were written by an earlier version of the app, another tab or a hand edit, so nothing
 * read back is trusted: each value is checked against its shape, and a value that fails gives the default instead.
 */

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** A `parse` for one of a fixed set of strings. */
export const stringIn =
  <T extends string>(...values: readonly T[]) =>
  (v: unknown): T | undefined =>
    values.includes(v as T) ? (v as T) : undefined;

/** A `parse` for a cursor on an id: a string, or `null` for none. */
export const idOrNull = (v: unknown): string | null | undefined =>
  v === null || typeof v === "string" ? v : undefined;

/** A `parse` for a whole number from `min` to `max`. */
export const intIn =
  (min: number, max: number) =>
  (v: unknown): number | undefined =>
    Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : undefined;

/** A finite number, for a field of a record. */
export const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
