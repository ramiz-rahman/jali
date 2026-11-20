/**
 * Each island's last line of defence: if a live part throws, the reader gets a short message in its place and the
 * rest of the page keeps working. It renders nothing of its own otherwise, so the prerendered HTML and the browser's
 * first render are the same.
 */
import { Component, type ReactNode } from "react";

export class IslandBoundary extends Component<
  { children: ReactNode; onHydrated?: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  /** The browser passes `onHydrated` (src/client/islands.ts); the build doesn't, and it adds nothing to the HTML. */
  componentDidMount() {
    this.props.onHydrated?.();
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <p className="island-error" role="alert">
        This demo didn't load.{" "}
        <button type="button" className="page-action" onClick={() => window.location.reload()}>
          Reload the page
        </button>
      </p>
    );
  }
}
