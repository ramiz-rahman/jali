/**
 * Data fetched from a public source (store.ts `Remote`), in a pane: nothing yet, loading, failed with a retry (held
 * back while the source asked to be left alone), or the content.
 */
import { useEffect, useState, type ReactNode } from "react";
import type { Remote } from "#src/store.ts";
import { Failed, Loading } from "./states";

/** Re-render once `at` has passed, so a button held back until then comes back by itself. */
function useAfter(at: number | undefined): boolean {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!at || at <= Date.now()) return;
    // setTimeout's longest wait is 2^31 - 1 ms.
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(2_147_483_647, at - Date.now() + 25),
    );
    return () => clearTimeout(timer);
  }, [at]);
  return !at || at <= now;
}

export function RemoteState<T>({
  value,
  label,
  retry,
  idle = null,
  children,
}: {
  value: Remote<T>;
  /** What is being fetched: "RDAP", "Cloudflare A". */
  label: string;
  retry: () => void;
  /** What to show before anything has been asked for. */
  idle?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const retryAt = value.status === "failed" ? value.retryAt : undefined;
  const canRetry = useAfter(retryAt);
  switch (value.status) {
    case "idle":
      return <>{idle}</>;
    case "loading":
      return <Loading label={`Loading ${label}`} />;
    case "failed":
      return (
        <>
          <Failed title={`${label} unavailable`} retry={canRetry ? retry : undefined}>
            {value.error}
          </Failed>
          {!canRetry && retryAt ? (
            <p className="hs-note">
              Retry after {new Date(retryAt).toLocaleTimeString()}. A new Probe respects this
              cooldown too.
            </p>
          ) : null}
        </>
      );
    case "ready":
      return <>{children(value.data)}</>;
  }
}
