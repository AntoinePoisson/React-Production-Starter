import { useLingui } from '@lingui/react/macro';

/**
 * Shown while the canvas chunk downloads. DOM only — the shell imports this
 * statically, so anything it touches is on the critical path. useProgress
 * here once pulled ~220 kB of three.js into the first load. Don't.
 */
export default function BootLoader() {
  const { t } = useLingui();

  return (
    <div className='fixed inset-0 flex items-center justify-center'>
      <p className='text-ink-muted text-sm'>{t`Loading…`}</p>
    </div>
  );
}
