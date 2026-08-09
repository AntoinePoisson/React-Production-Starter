import { useLingui } from '@lingui/react/macro';

/**
 * Shell fallback while the canvas chunk downloads. DOM only, and that matters: the shell imports
 * this statically, so anything it touches lands in the entry graph. Using drei's useProgress here
 * pulled ~220 kB of three.js into the first load. Keep the imports to React and i18n.
 */
export default function BootLoader() {
  const { t } = useLingui();

  return (
    <div className='fixed inset-0 flex items-center justify-center'>
      <p className='text-ink-muted text-sm'>{t`Loading…`}</p>
    </div>
  );
}
