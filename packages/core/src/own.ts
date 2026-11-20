/**
 * Records keyed by something from outside (a pane id, a kind's name, a param) are read through `own`, so a key that
 * names something on `Object.prototype` (`constructor`, `toString`, `__proto__`) is never mistaken for an entry.
 */

/** `record[key]` when `key` is one of the record's own keys; otherwise undefined. */
export const own = <T>(
  record: Readonly<Record<string, T>> | null | undefined,
  key: string | null | undefined,
): T | undefined =>
  record != null && key != null && Object.hasOwn(record, key) ? record[key] : undefined;
