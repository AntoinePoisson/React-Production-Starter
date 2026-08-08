import { useLingui } from '@lingui/react/macro';

// fixed for the same reason as ErrorPage: the canvas wrapper is a full-height block and the body
// does not scroll, so a normal-flow <main> renders below the fold and is unreachable.
export default function Loading() {
  const { t } = useLingui();

  return (
    <main className='pointer-events-none fixed inset-0 flex items-center justify-center'>
      <p className='text-ink-muted animate-pulse text-sm'>{t`Loading…`}</p>
    </main>
  );
}
