/** Small DOM helpers the page's behaviours (the `.client.ts` files beside the components) share. */

/** Every element matching `sel` under `from`, as an array. */
export const all = <E extends Element = HTMLElement>(sel: string, from: ParentNode = document) => [
  ...from.querySelectorAll<E>(sel),
];

/**
 * A roving focus's next stop along a row of `n` items from `i`: the arrows (Left and Right, and Up and Down when
 * `vertical`), Home and End. -1 for any other key.
 */
export function rovingIndex(e: KeyboardEvent, i: number, n: number, vertical = false): number {
  const next = e.key === "ArrowRight" || (vertical && e.key === "ArrowDown");
  const prev = e.key === "ArrowLeft" || (vertical && e.key === "ArrowUp");
  if (next) return (i + 1) % n;
  if (prev) return (i - 1 + n) % n;
  if (e.key === "Home") return 0;
  if (e.key === "End") return n - 1;
  return -1;
}
