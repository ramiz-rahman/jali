/**
 * What the app keeps on this device, and the checks it reads it back through. The reactive store itself is the
 * examples' shared one (`@jali-examples/shared/store`); this is only the reading and writing.
 *
 * Studio keeps its own reading and writing rather than the shared `readKept`: its stores carry their version in the
 * key (`studio:edits:v1`), move a value kept under an earlier key across on first read, and keep the plain JSON people
 * already have saved, which the shared `{ v, data }` envelope would read as a version-0 value instead.
 *
 * Nothing read back is trusted: it was written by an earlier version of the app, another tab or a hand edit. Each
 * value goes through a `parse` that checks its shape and gives the default for anything it doesn't recognise.
 */
import { isRecord } from "@jali-examples/shared/store";

/** What is kept under `key`, parsed; `undefined` for nothing, text that isn't JSON, or storage that is blocked. */
function stored(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** JSON in localStorage, never throwing: a private window or blocked storage simply keeps nothing. */
export const saved = {
  read<T>(key: string, parse: (stored: unknown) => T): T {
    return parse(stored(key));
  },
  /**
   * As `read`, for a store whose key carries its version (`studio:edits:v1`). While nothing is kept under it yet,
   * what an earlier key of the same shape held (`earlier`) is read through the same `parse`, kept under the new key,
   * and forgotten under the old, so nobody loses their work to the change of key.
   */
  readVersioned<T>(key: string, earlier: string, parse: (stored: unknown) => T): T {
    const now = stored(key);
    if (now !== undefined) return parse(now);
    const before = stored(earlier);
    const value = parse(before);
    if (before !== undefined) {
      saved.write(key, value);
      saved.remove(earlier);
    }
    return value;
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      // nothing kept, nothing to forget
    }
  },
  write(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // nothing to do: the value lives on in memory for this visit
    }
  },
};

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

/** A `parse` for a string or `null` (a cursor on an id, a draft not started). */
export const stringOrNull = (v: unknown): string | null | undefined =>
  v === null || typeof v === "string" ? v : undefined;

/** A `parse` for a flag. */
export const asBoolean = (v: unknown): boolean | undefined =>
  typeof v === "boolean" ? v : undefined;
