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

// ~220 kB of three.js, kept off the first load. lazy() only works if nothing else
// in this file imports that graph — one useProgress up there and it's all back.
const ThreeCanvas = lazy(() => import('@/components/three/Canvas'));
const Experiences = lazy(() => import('@/scene/Experiences'));

/**
 * Document shell. No index.html — TanStack Start renders <html>, so lang can differ per locale.
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
  const isStaticNotFoundDocument = pathname === '/404';

  // Same instance across renders. useLocaleSwitch calls activate() on it;
  // a new one every time would throw that away.
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

          {/* Canvas lives here, not in the page — / and /fr are different routes, so
              switching language would otherwise kill the WebGL context. Suspense is
              required: lazy() suspends, and without a boundary the whole tree goes down. */}
          {!isStaticNotFoundDocument && (
            <ClientOnly fallback={<BootLoader />}>
              {() => (
                <Suspense fallback={<BootLoader />}>
                  <ThreeCanvas>
                    <Experiences />
                  </ThreeCanvas>
                </Suspense>
              )}
            </ClientOnly>
          )}

          {children}
        </I18nProvider>

        <Scripts />
      </body>
    </html>
  );
}
