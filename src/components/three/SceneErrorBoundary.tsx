import { Component, type ReactNode } from 'react';

import { createLogger } from '@/utils/logger/Logger';

const log = createLogger('scene-boundary');

/**
 * Keeps one failed asset from taking the whole page down. `<Suspense>` catches pending, never
 * failed: suspend-react caches a rejected GLB and re-throws it on every render, so without a
 * boundary inside the scene the throw reaches `app/[locale]/error.tsx`, which replaces `<main>`.
 * A class because `getDerivedStateFromError` has no hook equivalent. No retry here: reload is the
 * recovery.
 */
interface Props {
  children: ReactNode;
  /** Rendered in place of the children once they have failed. Must be scene-safe. */
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
    // `once` because a failed subtree is re-rendered by any parent update.
    log.once('scene-subtree-failed').error('Scene subtree failed to render', error);
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
