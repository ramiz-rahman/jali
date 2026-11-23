/**
 * A boundary around the host's code in Jali's chrome (a kind's icon, a host icon, a page's rail and header, Settings'
 * extra fieldsets, and the root's children and dialogs): a throw there replaces that part with `fallback` (nothing by
 * default), not the instance, and never unmounts the host's app. When the instance it is inside is replaced by
 * another (`<JaliRoot jali>` changed), it tries its children again: the failure was the old instance's.
 */
import { Component, type ReactNode } from "react";
import { useOptionalStore } from "../state/react";

interface Props {
  children?: ReactNode;
  /** What shows instead, given a retry that renders the children again. */
  fallback?: (retry: () => void) => ReactNode;
  onError?: (error: unknown) => void;
}

interface BoundaryProps extends Props {
  /** The instance the boundary is in; another one resets it. */
  instance: unknown;
}

interface State {
  failed: boolean;
  instance: unknown;
}

class Boundary extends Component<BoundaryProps, State> {
  override state: State = { failed: false, instance: this.props.instance };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  static getDerivedStateFromProps(
    { instance }: BoundaryProps,
    state: State,
  ): Partial<State> | null {
    return instance === state.instance ? null : { failed: false, instance };
  }
  override componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }
  retry = () => this.setState({ failed: false });
  override render() {
    return this.state.failed ? (this.props.fallback?.(this.retry) ?? null) : this.props.children;
  }
}

export function Guard(props: Props) {
  return <Boundary {...props} instance={useOptionalStore()} />;
}
