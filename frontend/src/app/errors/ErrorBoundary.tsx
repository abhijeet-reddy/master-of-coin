import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Rendered instead of children after a render error. */
  fallback: (error: Error, reset: () => void) => ReactNode;
  /** Changing this clears the error (e.g. the route path). */
  resetKey?: string;
}

interface State {
  error: Error | null;
  key: string | undefined;
}

/** Minimal class boundary; everything visual lives in the fallbacks. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.key) return { error: null, key: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    return this.state.error
      ? this.props.fallback(this.state.error, this.reset)
      : this.props.children;
  }
}
