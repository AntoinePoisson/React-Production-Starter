import { useLingui } from '@lingui/react/macro';

/** Route-level fallback, shown while a page's chunk loads. */
export default function Loading() {
  const { t } = useLingui();

  return (
    <main className='flex h-full w-full items-center justify-center'>
      <p className='animate-pulse text-sm opacity-70'>{t`Loading…`}</p>
    </main>
  );
}
