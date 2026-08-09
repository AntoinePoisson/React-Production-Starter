import { I18nProvider } from '@lingui/react';
import { useLingui } from '@lingui/react/macro';
import { HeadContent, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router';
import { Suspense, lazy, useMemo } from 'react';

import { useBoot } from '@/app/Boot';
import appCss from '@/app/globals.css?url';
import { rootHead } from '@/app/Metadata';
import ErrorPage from '@/app/pages/ErrorPage';
import Loading from '@/app/pages/Loading';
import NotFound from '@/app/pages/NotFound';
import ClientOnly from '@/components/ClientOnly';
import BootLoader from '@/components/ui/BootLoader';
import { getI18n } from '@/i18n/I18n';
import { LOCALE_TAGS } from '@/i18n/Routing';
import { localeFromPath } from '@/i18n/useLocaleSwitch';

// three.js + drei + the scene are ~220 kB, kept out of the first load. lazy() only holds that
// line as long as nothing else in this file reaches into the same graph, so watch the static
// imports above: one of them calling drei's useProgress is enough to undo all of it.
const ThreeCanvas = lazy(() => import('@/components/three/Canvas'));
const Experiences = lazy(() => import('@/scene/Experiences'));

/**
 * The document shell. There is no index.html, TanStack Start renders <html> itself, which is what
 * lets <html lang> differ per locale.
 */
export const Route = createRootRoute({
  head: () => {
    const { meta, links } = rootHead();

    return { meta, links: [...links, { rel: 'stylesheet', href: appCss }] };
  },
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
  errorComponent: ErrorPage,
  pendingComponent: Loading
});

function NoScriptNotice() {
  const { t } = useLingui();

  return (
    <noscript>
      <p className='p-6'>{t`This experience needs JavaScript enabled to run.`}</p>
    </noscript>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const locale = localeFromPath(pathname);

  // For identity, not speed. useLocaleSwitch calls activate() on the mounted instance and a fresh
  // one on every render would throw that call away.
  const i18n = useMemo(() => getI18n(locale), [locale]);

  useBoot();

  return (
    <html lang={LOCALE_TAGS[locale]}>
      <head>
        <HeadContent />
      </head>
      <body>
        <I18nProvider i18n={i18n}>
          <NoScriptNotice />

          {/* Mounted here and not in the page. / and /fr are different routes, so a scene
              mounted in either gets destroyed on every language switch. The Suspense is
              mandatory, lazy() suspends and an unbounded suspension takes the tree down. */}
          <ClientOnly fallback={<BootLoader />}>
            {() => (
              <Suspense fallback={<BootLoader />}>
                <ThreeCanvas>
                  <Experiences />
                </ThreeCanvas>
              </Suspense>
            )}
          </ClientOnly>

          {children}
        </I18nProvider>

        <Scripts />
      </body>
    </html>
  );
}
