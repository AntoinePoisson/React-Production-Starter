import { useLingui } from '@lingui/react/macro';

/**
 * The fallback the document shell shows while the canvas chunk downloads.
 *
 * DOM only, and that is the whole point: the shell imports this statically, so anything it
 * touches lands in the entry graph. Reaching for drei's `useProgress` here — the obvious way to
 * show a percentage — pulled three.js and drei into the first load, ~220 kB brotli
 * `modulepreload`ed ahead of first paint, to display a counter that reads 0 % until an asset
 * actually starts downloading. Keep the imports of this file to React and i18n.
 *
 * The percentage still exists where it means something: `components/three/Loader.tsx`, inside the
 * lazily loaded canvas.
 */
export default function BootLoader() {
  const { t } = useLingui();

  return (
    <div className='fixed inset-0 flex items-center justify-center'>
      <p className='text-ink-muted text-sm'>{t`Loading…`}</p>
    </div>
  );
}
