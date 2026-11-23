/**
 * What is kept on this device, and the checks for what comes back. The plan (plan-store.ts, `readPlan`) and each
 * pane's own state (`usePaneState`'s `parse`) were written by an earlier version of the app, another tab or a hand
 * edit, so nothing read back is trusted: each value is checked against its shape, and a value that fails gives the
 * default instead.
 */

/**
 * JSON in localStorage, never throwing: a private window or blocked storage keeps nothing. `parse` gets the stored
 * value (`undefined` when there is none, or it isn't JSON) and returns the value to use, its default for anything it
 * doesn't recognise.
 */
export const saved = {
  read<T>(key: string, parse: (stored: unknown) => T): T {
    let stored: unknown;
    try {
      const raw = localStorage.getItem(key);
      stored = raw === null ? undefined : JSON.parse(raw);
    } catch {
      stored = undefined;
    }
    return parse(stored);
  },
  write(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // the value lives on in memory for this visit
    }
  },
};

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

/** A finite number, for a field of a record. */
export const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
