/**
 * Each pane's content renders inside its own error boundary and Suspense boundary, so a pane that throws or waits
 * never takes the instance with it. A failed pane keeps its place and offers Retry and Close; a waiting pane shows
 * its kind's `Loading` (or a quiet default). Both report their state as the pane's activity.
 */
import { Component, Fragment, Suspense, useEffect, type ReactNode } from "react";
import type { PaneHost } from "./context";
import { useReporter } from "./hooks";
import { useMessages } from "../state/react";
import type { PaneHydration } from "../state/hydration";

interface BoundaryProps {
  /** What the pane shows: a new value clears a failure, as the content is now about something else. */
  resetKey: unknown;
  host: PaneHost;
  /** The pane's name, for the failed state ("Order 3 could not be shown"). */
  name: string;
  /** Close the pane (or the peek sheet). */
  close: () => void;
  onError: (error: unknown) => void;
  loading: ReactNode;
  /** The instance's boundaries as they hydrate: one that mounts before its content holds the instance's measuring
   *  back until the content arrives (state/hydration.ts). */
  hydration: PaneHydration;
  children: ReactNode;
}

interface BoundaryState {
  failed: boolean;
  error: unknown;
  /** Bumped by Retry: the content mounts afresh. */
  attempt: number;
}

export class PaneBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false, error: undefined, attempt: 0 };

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { failed: true, error };
  }

  override componentDidMount() {
    this.props.hydration.wait(this);
  }

  override componentWillUnmount() {
    this.props.hydration.arrive(this);
  }

  override componentDidCatch(error: unknown) {
    // The failed state replaces the content: nothing is left to hydrate.
    this.props.hydration.arrive(this);
    this.props.onError(error);
  }

  override componentDidUpdate(prev: BoundaryProps) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.retry();
  }

  retry = () => this.setState((s) => ({ failed: false, error: undefined, attempt: s.attempt + 1 }));

  override render() {
    const { host, name, close, loading, hydration, children } = this.props;
    if (this.state.failed)
      return (
        <PaneFailed
          host={host}
          name={name}
          error={this.state.error}
          retry={this.retry}
          close={close}
        />
      );
    return (
      <Fragment key={this.state.attempt}>
        <Suspense fallback={<PaneLoading host={host}>{loading}</PaneLoading>}>
          <Arrived boundary={this} hydration={hydration} />
          {children}
        </Suspense>
      </Fragment>
    );
  }
}

/** Mounts with the content, as one commit: when it runs, the boundary has hydrated (or its content has shown). */
function Arrived({ boundary, hydration }: { boundary: object; hydration: PaneHydration }) {
  useEffect(() => hydration.arrive(boundary), [boundary, hydration]);
  return null;
}

/** While the content waits: activity "loading", back to "idle" once it shows. */
function PaneLoading({ host, children }: { host: PaneHost; children: ReactNode }) {
  // A caller of its own, like any component's useActivity: it neither overwrites nor clears the content's.
  const report = useReporter(host);
  useEffect(() => {
    report({ activity: "loading" });
    return () => report(null);
  }, [report]);
  return <>{children}</>;
}

/** The default `Loading`: quiet, and read once by screen readers. */
export function DefaultLoading() {
  return (
    <div className="jali-pane-loading" role="status">
      {useMessages().pane.loadingContent}
    </div>
  );
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : typeof error === "string" ? error : "";

/** The failed state: what failed, Retry (also in ⌘K while the pane is focused) and Close. Activity "error". */
function PaneFailed({
  host,
  name,
  error,
  retry,
  close,
}: {
  host: PaneHost;
  name: string;
  error: unknown;
  retry: () => void;
  close: () => void;
}) {
  const t = useMessages().pane;
  const report = useReporter(host);
  useEffect(() => {
    report({ activity: "error", commands: [{ id: "retry", title: t.retryCommand, run: retry }] });
    return () => report(null);
  }, [report, retry, t]);
  const message = messageOf(error);
  return (
    <div className="jali-pane-failed" role="alert">
      <strong>{t.failed(name)}</strong>
      {message ? <span className="jali-pane-failed-message">{message}</span> : null}
      <div className="jali-pane-failed-actions">
        <button type="button" className="jali-text-btn is-primary" onClick={retry}>
          {t.retry}
        </button>
        <button type="button" className="jali-text-btn" onClick={close}>
          {t.closeFailed}
        </button>
      </div>
    </div>
  );
}
