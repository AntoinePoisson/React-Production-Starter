import { Component, type ReactNode } from 'react';

import { createLogger } from '@/utils/logger/Logger';

const log = createLogger('scene-boundary');

/**
 * Suspense only catches pending. A rejected GLB gets cached and rethrown every
 * render, so without this the whole page dies. Class because there's still
 * no hook for getDerivedStateFromError.
 */
interface Props {
  children: ReactNode;
  /** Has to be safe to put inside the canvas. */
  fallback?: ReactNode;
}

interface State {
  failed: boolean;
}

export default class SceneErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    // once() — a parent update re-renders the failed subtree.
    log.once('scene-subtree-failed').error('Scene subtree failed to render', error);
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
