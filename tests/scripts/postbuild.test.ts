import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { inlineStylesheet } from '../../scripts/postbuild.mjs';

const CSS = ':root{--color-ink:#0b1220}';
const HASH = `sha256-${createHash('sha256').update(CSS).digest('base64')}`;

/** As React renders it: attribute values double-quoted, every `'` escaped to `&#x27;`. */
const document = (policy: string, ...links: string[]) =>
  '<!DOCTYPE html><html><head><meta charSet="utf-8"/>' +
  `<meta http-equiv="Content-Security-Policy" content="${policy.replaceAll("'", '&#x27;')}"/>` +
  `${links.join('')}</head><body></body></html>`;

const POLICY = "default-src 'self'; style-src 'self'; img-src 'self' data:";
const LINK = '<link rel="stylesheet" href="/static/globals-Be4kbYxj.css" data-precedence="default"/>';

const readCss = () => CSS;

/**
 * The build step that takes the last render-blocking request off the critical path.
 *
 * Every assertion here stands for a page that would ship looking broken in a way no reviewer
 * sees: a policy that refuses the stylesheet it was just handed renders an unstyled document,
 * and the build itself stays green.
 */
describe('inlineStylesheet', () => {
  it('should replace the link with the sheet itself', () => {
    const html = inlineStylesheet(document(POLICY, LINK), readCss);

    expect(html).toContain(`<style>${CSS}</style>`);
    expect(html).not.toContain('rel="stylesheet"');
  });

  it('should authorise the inlined sheet by hash', () => {
    const html = inlineStylesheet(document(POLICY, LINK), readCss);

    // Escaped the way the surrounding attribute is: a raw quote here would close it.
    expect(html).toContain(`style-src &#x27;self&#x27; &#x27;${HASH}&#x27;`);
  });

  it('should leave the other directives untouched', () => {
    const html = inlineStylesheet(document(POLICY, LINK), readCss);

    expect(html).toContain('default-src &#x27;self&#x27;;');
    expect(html).toContain('img-src &#x27;self&#x27; data:');
  });

  it('should leave a stylesheet this build did not emit alone', () => {
    // Its bytes are not on disk, so there is nothing to inline and nothing to hash.
    const external = '<link rel="stylesheet" href="https://fonts.example/sheet.css"/>';
    const html = inlineStylesheet(document(POLICY, external), readCss);

    expect(html).toContain(external);
    expect(html).not.toContain('sha256-');
  });

  it('should hash every sheet it inlines', () => {
    const second = '<link rel="stylesheet" href="/static/extra-DEADBEEF.css"/>';
    const readOne = vi.fn((href: string) => (href.includes('extra') ? '@media print{}' : CSS));
    const html = inlineStylesheet(document(POLICY, LINK, second), readOne);

    expect(html.match(/sha256-/g)).toHaveLength(2);
    expect(readOne).toHaveBeenCalledTimes(2);
  });

  it('should refuse to ship a policy that would block the sheet', () => {
    // Without `style-src`, `default-src` applies and refuses the `<style>` element wholesale.
    expect(() => inlineStylesheet(document("default-src 'self'", LINK), readCss)).toThrow(/style-src/);
  });

  it('should pass a document with no stylesheet through untouched', () => {
    const html = document(POLICY);

    expect(inlineStylesheet(html, readCss)).toBe(html);
  });
});
