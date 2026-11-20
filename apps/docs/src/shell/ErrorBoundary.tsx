/**
 * The shell's last line of defence: if rendering throws, the reader gets a short message and a way on, not a blank
 * page.
 */
import { Component, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="main" role="alert" style={{ padding: "4rem 1.5rem", maxWidth: "40rem" }}>
        <h1 className="page-title">This page didn't load</h1>
        <p className="page-summary">
          Something went wrong while showing it. Reloading usually fixes it.
        </p>
        <p>
          <button type="button" className="page-action" onClick={() => window.location.reload()}>
            Reload the page
          </button>{" "}
          <a className="page-action" href="/">
            Docs home
          </a>
        </p>
      </main>
    );
  }
}
