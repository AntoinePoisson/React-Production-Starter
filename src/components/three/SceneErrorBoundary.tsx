import { Component, type ReactNode } from 'react';

import { createLogger } from '@/utils/logger/Logger';

const log = createLogger('scene-boundary');

/**
 * Suspense catches pending, never failed: suspend-react caches a rejected GLB and rethrows it on
 * every render, so without this the throw replaces the whole page. A class because
 * getDerivedStateFromError still has no hook equivalent.
 */
interface Props {
  children: ReactNode;
  /** Has to be scene-safe. */
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
    // once() because any parent update re-renders the failed subtree.
    log.once('scene-subtree-failed').error('Scene subtree failed to render', error);
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
