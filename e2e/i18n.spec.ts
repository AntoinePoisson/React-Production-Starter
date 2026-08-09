import { expect, test } from './fixtures/webVitalsFixture';
import { SCENE_BOOT_FAILURE, requiresWorkingWebGL } from './utils/testHelpers';
import { waitForR3FScene } from './utils/webVitals';

// Two seperate documents on two URLs, no redirect between them, no JavaScript needed to move
// between them, and no navigation when there is.

const LOCALES = [
  { name: 'English', path: '/', tag: 'en-US', marker: 'drag to orbit' },
  { name: 'French', path: '/fr', tag: 'fr-FR', marker: 'glissez pour pivoter' }
] as const;

// One assertion below only holds against a production build. Outside production Lingui's
// descriptorFields is 'all', which keeps every English sentence in the client chunks.
// Locally: pnpm website, then BASE_URL=http://localhost:3200 pnpm e2e
const MEASURES_PRODUCTION_BUILD = Boolean(process.env.CI || process.env.BASE_URL);

test.describe('Locale routing', () => {
  test.describe.configure({ mode: 'parallel' });

  for (const locale of LOCALES) {
    test(`should serve ${locale.name} at ${locale.path} with the right lang`, async ({ pageWithVitals }) => {
      const response = await pageWithVitals.goto(locale.path);

      // Pathname compared exactly, slash included. status() reports the end of the redirect
      // chain, so a server bouncing /fr to /fr/ would still read 200 here.
      expect(response?.status()).toBe(200);
      expect(new URL(pageWithVitals.url()).pathname).toBe(locale.path);

      await expect(pageWithVitals.locator('html')).toHaveAttribute('lang', locale.tag);
      await expect(pageWithVitals.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(pageWithVitals.locator('body')).toContainText(locale.marker);
    });

    test(`should declare hreflang alternates on ${locale.name}`, async ({ pageWithVitals }) => {
      await pageWithVitals.goto(locale.path);

      // Without these Google treats the translations as duplicates and indexes one.
      for (const other of LOCALES) {
        const link = pageWithVitals.locator(`link[rel="alternate"][hreflang="${other.tag}" i]`);
        await expect(link).toHaveCount(1);
      }
      await expect(pageWithVitals.locator('link[rel="alternate"][hreflang="x-default" i]')).toHaveCount(1);
    });

    test(`should point ${locale.name} at its own canonical`, async ({ pageWithVitals }) => {
      await pageWithVitals.goto(locale.path);

      const canonical = await pageWithVitals.locator('link[rel="canonical"]').getAttribute('href');
      expect(new URL(canonical as string).pathname).toBe(locale.path);
    });
  }

  test('should switch language without reloading the document', async ({ pageWithVitals }) => {
    await pageWithVitals.goto('/');

    // A stamp on window survives any number of re-renders and cannot survive a navigation.
    await pageWithVitals.evaluate(() => {
      (window as unknown as { __sameDocument: boolean }).__sameDocument = true;
    });

    // Still a real href, crawlers and cmd-click need it. Only the plain click is intercepted.
    const toFrench = pageWithVitals.getByRole('link', { name: 'Français' });
    await expect(toFrench).toHaveAttribute('href', '/fr');
    await toFrench.click();

    await expect(pageWithVitals.locator('html')).toHaveAttribute('lang', 'fr-FR');
    await expect(pageWithVitals.locator('body')).toContainText('glissez pour pivoter');

    // The URL has to follow, or a reload lands back on English and a shared link is wrong.
    expect(new URL(pageWithVitals.url()).pathname).toBe('/fr');

    const sameDocument = await pageWithVitals.evaluate(
      () => (window as unknown as { __sameDocument?: boolean }).__sameDocument === true
    );
    expect(sameDocument, 'the switch reloaded the document instead of swapping the catalogue').toBe(true);

    // Back again, the reverse direction loads a catalogue that was never in the initial payload.
    const back = pageWithVitals.getByRole('link', { name: 'English' });
    await expect(back).toHaveAttribute('href', '/');
    await back.click();
    await expect(pageWithVitals.locator('html')).toHaveAttribute('lang', 'en-US');
    await expect(pageWithVitals.locator('body')).toContainText('drag to orbit');
  });

  test('should keep the WebGL context across a language switch', async ({ pageWithVitals }, testInfo) => {
    await pageWithVitals.goto('/');

    const sceneLoaded = await waitForR3FScene(pageWithVitals, 30000);
    if (!sceneLoaded) {
      if (requiresWorkingWebGL(testInfo)) throw new Error(SCENE_BOOT_FAILURE);
      test.skip(true, 'Headless WebGL unavailable on this engine');

      return;
    }

    // React replaces the canvas element on a remount, the browser on a navigation. A stamp that
    // survives means the same element, and so the same context, geometry and camera.
    await pageWithVitals.evaluate(() => {
      (document.querySelector('canvas') as unknown as { __stamped: boolean }).__stamped = true;
    });

    await pageWithVitals.getByRole('link', { name: 'Français' }).click();
    await expect(pageWithVitals.locator('html')).toHaveAttribute('lang', 'fr-FR');

    const stamped = await pageWithVitals.evaluate(
      () => (document.querySelector('canvas') as unknown as { __stamped?: boolean })?.__stamped === true
    );
    expect(stamped, 'the canvas was recreated, its context, camera and scene went with it').toBe(true);
  });

  test('should follow the back button after a switch', async ({ pageWithVitals }) => {
    await pageWithVitals.goto('/');
    await pageWithVitals.getByRole('link', { name: 'Français' }).click();
    await expect(pageWithVitals.locator('html')).toHaveAttribute('lang', 'fr-FR');

    await pageWithVitals.goBack();

    // pushState adds a session-history entry, the back button has to be able to undo it.
    await expect(pageWithVitals.locator('html')).toHaveAttribute('lang', 'en-US');
    await expect(pageWithVitals.locator('body')).toContainText('drag to orbit');
    expect(new URL(pageWithVitals.url()).pathname).toBe('/');
  });

  test('should not link the current locale to itself', async ({ pageWithVitals }) => {
    await pageWithVitals.goto('/fr');

    // A link to the page you're already on is noise for keyboard and screen-reader users.
    const nav = pageWithVitals.getByRole('navigation');
    await expect(nav.getByRole('link')).toHaveCount(1);
    await expect(nav).toContainText('Français');
  });

  test('should translate the copy, not just the markup', async ({ pageWithVitals }) => {
    await pageWithVitals.goto('/');
    const english = await pageWithVitals.getByRole('heading', { level: 1 }).locator('..').innerText();

    await pageWithVitals.goto('/fr');
    const french = await pageWithVitals.getByRole('heading', { level: 1 }).locator('..').innerText();

    expect(french).not.toBe(english);
  });

  test('should ship the copy in the HTML rather than in the JavaScript', async ({ pageWithVitals, request }) => {
    // Holds on every build, the copy is server-rendered either way.
    const html = await (await request.get('/fr')).text();
    expect(html).toContain('glissez pour pivoter');

    test.skip(!MEASURES_PRODUCTION_BUILD, 'the chunk check only holds against a production build');

    await pageWithVitals.goto('/fr');
    const scripts = await pageWithVitals
      .locator('script[src]')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).src));

    // No catalogue may reach the initial payload. A production build strips the source text from
    // <Trans>, so a chunk carrying readable UI copy means something imported a catalogue
    // statically. useLocaleSwitch.ts names both, but only through import().
    for (const src of scripts) {
      const body = await (await request.get(src)).text();
      for (const locale of LOCALES) {
        expect(body, `${src} carries ${locale.name} UI copy that should have stayed on the server`).not.toContain(
          locale.marker
        );
      }
    }
  });
});

// useLocaleSwitch is an enhancement. With no JavaScript the anchor carries the whole feature on
// its own, which is also what a crawler does with it.
test.describe('Locale routing without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('should still switch language by following the link', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Français' }).click();

    expect(new URL(page.url()).pathname).toBe('/fr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
    await expect(page.locator('body')).toContainText('glissez pour pivoter');
  });
});
