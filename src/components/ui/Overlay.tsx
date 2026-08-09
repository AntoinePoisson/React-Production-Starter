import { Trans, useLingui } from '@lingui/react/macro';

import { SITE_TITLE } from '@/utils/config/Identity';

import FirstVisitReveal from './FirstVisitReveal';
import LanguageSwitcher from './LanguageSwitcher';

/**
 * Copy stays in the DOM instead of a 3D texture: selectable, translatable, indexable, accessible.
 * It's also in the prerendered HTML, so it paints before the 3D bundle downloads.
 */
export default function Overlay() {
  const { t } = useLingui();

  return (
    <FirstVisitReveal className='inset-safe pointer-events-none fixed inset-0 flex flex-col justify-between'>
      {/* pointer-events-auto goes on the copy and not the header. The container is
          pointer-events-none so drags orbit the camera, which also kills text selection.
          w-fit keeps the reclaimed area on the glyphs. */}
      {/* SITE_TITLE and not a translated message: a proper noun run through t() becomes a
          catalogue entry that every locale then owes an identity translation for. */}
      <header>
        <h1 className='text-ink pointer-events-auto w-fit text-2xl font-semibold tracking-tight sm:text-4xl lg:text-5xl'>
          {SITE_TITLE}
        </h1>
        <p className='text-ink-muted pointer-events-auto mt-1 w-fit max-w-md text-sm sm:text-base'>
          {t`React + Vite + React Three Fiber starter — drag to orbit, scroll to zoom.`}
        </p>
      </header>

      <div className='flex items-end justify-between gap-4'>
        {/* A CSS variant, not useBreakpoint(): a purely visual branch costs no subscription. */}
        <footer className='text-ink-subtle hidden text-xs sm:block sm:text-sm'>
          {/* <Trans> and not t(), which returns a string and this sentence wraps an element. */}
          <p className='pointer-events-auto w-fit'>
            <Trans>
              Edit this overlay in <code className='bg-ink/10 rounded px-1 py-0.5'>src/components/ui/Overlay.tsx</code>
            </Trans>
          </p>
        </footer>

        <LanguageSwitcher />
      </div>
    </FirstVisitReveal>
  );
}
