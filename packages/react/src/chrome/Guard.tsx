/**
 * A boundary around the host's code in Jali's chrome (a kind's icon, a host icon, a page's rail and header, Settings'
 * extra fieldsets, and the root's children and dialogs): a throw there replaces that part with `fallback` (nothing by
 * default), not the instance, and never unmounts the host's app. When the instance it is inside is replaced by
 * another (`<JaliRoot jali>` changed), it tries its children again: the failure was the old instance's.
 */
import { Component, type ReactNode } from "react";
import { StoreContext } from "../state/react";

interface Props {
  children?: ReactNode;
  /** What shows instead, given a retry that renders the children again. */
  fallback?: (retry: () => void) => ReactNode;
  onError?: (error: unknown) => void;
}

export class Guard extends Component<Props, { failed: boolean }> {
  static override contextType = StoreContext;
  override state = { failed: false };
  /** The instance it last rendered in. */
  private seen = this.context;
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }
  override componentDidUpdate() {
    if (this.seen !== this.context) {
      this.seen = this.context;
      if (this.state.failed) this.setState({ failed: false });
    }
  }
  retry = () => this.setState({ failed: false });
  override render() {
    return this.state.failed ? (this.props.fallback?.(this.retry) ?? null) : this.props.children;
  }
}
