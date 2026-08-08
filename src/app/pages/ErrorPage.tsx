import { useLingui } from '@lingui/react/macro';
import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';

import { createLogger } from '@/utils/logger/Logger';

const log = createLogger('error-boundary');

// invalidate() retries the route. A full reload would kill the WebGL context.
export default function ErrorPage({ error }: { error: Error }) {
  const { t } = useLingui();
  const router = useRouter();

  useEffect(() => {
    log.error('Route error', error);
  }, [error]);

  // `fixed`, same as the overlay — otherwise this sits below the canvas with no way to scroll.
  return (
    <main className='pointer-events-none fixed inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center'>
      <h1 className='text-ink pointer-events-auto text-xl font-semibold'>{t`Something went wrong`}</h1>
      <p className='text-ink-muted pointer-events-auto max-w-md text-sm'>
        {t`The page hit an unexpected error. Trying again is usually enough; if it keeps happening, reload the site.`}
      </p>
      <button
        className='bg-ink text-surface pointer-events-auto cursor-pointer rounded-full px-5 py-2 text-sm font-medium'
        type='button'
        onClick={() => void router.invalidate()}
      >
        {t`Try again`}
      </button>
    </main>
  );
}
