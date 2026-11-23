/**
 * Handlers that keep one identity for a component's life but always run their latest version. For a list's rows: a
 * row memoised on its props re-renders when its own state changes, not because its parent made new closures.
 */
import { useMemo, useRef } from "react";

// A handler of any arguments: the rows' handlers each take their own.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handlers<T> = { [K in keyof T]: (...args: any[]) => unknown };

export function useHandlers<T extends Handlers<T>>(handlers: T): T {
  const latest = useRef(handlers);
  latest.current = handlers;
  return useMemo(
    () =>
      Object.fromEntries(
        Object.keys(latest.current).map((k) => [
          k,
          (...args: unknown[]) => latest.current[k as keyof T](...args),
        ]),
      ) as T,
    [],
  );
}
