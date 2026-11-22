/**
 * A boundary around the host's code in Jali's chrome (a kind's icon, a host icon, a page's rail and header, Settings'
 * extra fieldsets, and the root's children and dialogs): a throw there replaces that part with `fallback` (nothing by
 * default), not the workspace, and never unmounts the host's app.
 */
import { Component, type ReactNode } from "react";

interface Props {
  children?: ReactNode;
  /** What shows instead, given a retry that renders the children again. */
  fallback?: (retry: () => void) => ReactNode;
  onError?: (error: unknown) => void;
}

export class Guard extends Component<Props, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }
  retry = () => this.setState({ failed: false });
  override render() {
    return this.state.failed ? (this.props.fallback?.(this.retry) ?? null) : this.props.children;
  }
}
