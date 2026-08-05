import { Trans, useLingui } from '@lingui/react/macro';

import { SITE_TITLE } from '@/utils/config/Identity';

import FirstVisitReveal from './FirstVisitReveal';
import LanguageSwitcher from './LanguageSwitcher';

/**
 * DOM overlay above the canvas. Text stays in the DOM rather than in a 3D texture: selectable,
 * translatable, indexable, accessible. Only the canvas is client-only; this copy is in the
 * pre-rendered HTML and paints before the 3D bundle downloads (FCP 2.4s → 0.5s).
 */
export default function Overlay() {
  const { t } = useLingui();

  return (
    <FirstVisitReveal className='inset-safe pointer-events-none fixed inset-0 flex flex-col justify-between'>
      {/* `pointer-events-auto` on the copy itself, not on the <header>: the container is
          `pointer-events-none` so drags orbit the camera, but that also makes text
          unselectable. `w-fit` keeps the reclaimed area on the glyphs. */}
      {/* `SITE_TITLE`, not a translated message: a proper noun run through `t` becomes a catalogue
          entry every locale owes an identity translation, or `lingui compile --strict` fails. */}
      <header>
        <h1 className='text-ink pointer-events-auto w-fit text-2xl font-semibold tracking-tight sm:text-4xl lg:text-5xl'>
          {SITE_TITLE}
        </h1>
        <p className='text-ink-muted pointer-events-auto mt-1 w-fit max-w-md text-sm sm:text-base'>
          {t`React + Vite + React Three Fiber starter — drag to orbit, scroll to zoom.`}
        </p>
      </header>

      <div className='flex items-end justify-between gap-4'>
        {/* CSS variant rather than a hook: a purely visual branch costs no subscription and no
            re-render. Reach for useBreakpoint() when the decision changes what *runs*. */}
        <footer className='text-ink-subtle hidden text-xs sm:block sm:text-sm'>
          {/* `<Trans>` and not `t`: `t` returns a string, and this sentence wraps an element. */}
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
