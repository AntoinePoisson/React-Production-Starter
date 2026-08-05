import { Trans } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';

/**
 * Pre-rendered to `dist/client/404.html`. It carries its own `<title>` because a document
 * reached this way never ran a route's `head`.
 */
export default function NotFound() {
  return (
    <main>
      <title>Page not found — React App Fondation</title>
      <h1>
        <Trans>Page not found</Trans>
      </h1>
      <Link to='/'>
        <Trans>Back to home</Trans>
      </Link>
    </main>
  );
}
