/**
 * Layout stability breaches, as an instance reports them in development: an action that never moves anything (a
 * tab choice, a pin, a focus) moved panes, and `console.error` says `Layout stability: "<op>" …`. Installed once per
 * test file; the array is shared, so a test empties it (`breaches.length = 0`) when it starts. Other errors pass on.
 */
import { vi } from "vite-plus/test";

export function stabilityBreaches(): string[] {
  const breaches: string[] = [];
  const pass = console.error.bind(console);
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const op = /^Layout stability: "([^"]+)"/.exec(String(args[0]))?.[1];
    if (op) breaches.push(op);
    else pass(...args);
  });
  return breaches;
}
