/**
 * Checks for what comes back from storage. The app's stores (`edits.ts`, `layouts.ts`, the two settings) and each
 * pane's own state (`usePaneState`'s `parse`) were written by an earlier version of the app, another tab or a hand
 * edit, so nothing read back is trusted: each value is checked against its shape, and what fails gives the default.
 */

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** A finite number. */
export const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** A record's entries whose values pass `read` (`undefined` drops an entry), as a fresh record. */
export function recordOf<T>(
  v: unknown,
  read: (value: unknown) => T | undefined,
): Record<string, T> {
  if (!isRecord(v)) return {};
  // Built from entries, so a key such as "__proto__" stays an ordinary key.
  return Object.fromEntries(
    Object.entries(v).flatMap(([k, value]) => {
      const r = read(value);
      return r === undefined ? [] : [[k, r]];
    }),
  );
}

/** A string, else `undefined`: for `recordOf` and `parse`. */
export const asString = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** A `parse` for a string or `null` (a cursor on an id, a draft not started). */
export const stringOrNull = (v: unknown): string | null | undefined =>
  v === null || typeof v === "string" ? v : undefined;

/** A `parse` for a flag. */
export const asBoolean = (v: unknown): boolean | undefined =>
  typeof v === "boolean" ? v : undefined;
