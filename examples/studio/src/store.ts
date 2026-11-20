/**
 * What the app keeps on this device. The store itself is the examples' shared one (`#shared/store`).
 *
 * Studio keeps its own reading and writing rather than the shared `readKept`: its stores carry their version in the
 * key (`studio:edits:v1`), move a value kept under an earlier key across on first read, and keep the plain JSON people
 * already have saved, which the shared `{ v, data }` envelope would read as a version-0 value instead.
 */

/** What is kept under `key`, parsed; `undefined` for nothing, text that isn't JSON, or storage that is blocked. */
function stored(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * JSON in localStorage, never throwing: a private window or blocked storage simply keeps nothing. What is read is
 * never trusted: `parse` gets the stored value (`undefined` when there is none, or it isn't JSON) and returns the
 * value to use, its default for anything it doesn't recognise (stored.ts).
 */
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
