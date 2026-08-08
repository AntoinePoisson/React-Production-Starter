import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';

import { SITE_TITLE } from '@/utils/config/Identity';

/**
 * Prerendered to 404.html. Own <title> because a document reached this way
 * never ran a route's head() — we used to ship an English title over French copy.
 *
 * `fixed`, like the overlay. The canvas is a full-height block and the body
 * can't scroll, so a normal <main> ended up below the fold, unreachable.
 */
export default function NotFound() {
  const { t } = useLingui();

  return (
    <main className='pointer-events-none fixed inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center'>
      {/* One string, not a fragment — React 19 hoists <title> and rejects multiple children. */}
      <title>{`${t`Page not found`} | ${SITE_TITLE}`}</title>
      <meta
        content='noindex, nofollow'
        name='robots'
      />

      <h1 className='text-ink pointer-events-auto text-xl font-semibold'>
        <Trans>Page not found</Trans>
      </h1>

      <Link
        className='text-ink-subtle hover:text-ink pointer-events-auto flex min-h-11 items-center rounded-lg px-3 text-sm underline-offset-4 hover:underline'
        to='/'
      >
        <Trans>Back to home</Trans>
      </Link>
    </main>
  );
}
