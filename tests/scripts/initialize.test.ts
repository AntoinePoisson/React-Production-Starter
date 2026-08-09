import { describe, expect, it } from 'vitest';

import { TEMPLATE, applyReplacements, buildReplacements, toOrigin, toSlug, toTitle } from '../../initialize.js';

/**
 * The rename rules are exported so they can be asserted without a temp directory. A rename that
 * half-applies leaves a repo naming itself two different things, and that only surfaces weeks
 * later in a storage key or an og:title.
 */
describe('toSlug', () => {
  it.each([
    ['My Great App', 'my-great-app'],
    ['my-great-app', 'my-great-app'],
    ['  Spaced   Out  ', 'spaced-out'],
    ['Café Déjà Vu', 'cafe-deja-vu'],
    ['Weird!!Chars@@Here', 'weird-chars-here'],
    ['--leading-and-trailing--', 'leading-and-trailing']
  ])('should turn %j into %j', (input, expected) => {
    // A package name may only hold [a-z0-9-._~], so diacritics get folded and not dropped.
    // "Café" becoming "caf" would be worse than either.
    expect(toSlug(input)).toBe(expected);
  });
});

describe('toTitle', () => {
  it.each([
    ['my-great-app', 'My Great App'],
    ['My Great App', 'My Great App'],
    ['my_great_app', 'My Great App'],
    ['iOS Companion', 'iOS Companion']
  ])('should turn %j into %j', (input, expected) => {
    // A word that already carries capitals keeps them, "iOS" must not become "Ios".
    expect(toTitle(input)).toBe(expected);
  });
});

describe('toOrigin', () => {
  it.each([
    ['https://example.com', 'https://example.com'],
    ['https://example.com/', 'https://example.com'],
    ['https://example.com/some/path', 'https://example.com'],
    ['example.com', 'https://example.com']
  ])('should reduce %j to %j', (input, expected) => {
    expect(toOrigin(input)).toBe(expected);
  });

  it.each(['', 'not a url', '://'])('should return an empty string for %j', (input) => {
    // An empty origin means "not decided yet", and the SEO files already fail closed on one.
    // Throwing here would abort the whole rename over an optional field.
    expect(toOrigin(input)).toBe('');
  });
});

describe('buildReplacements', () => {
  const answers = {
    title: 'My Great App',
    slug: 'my-great-app',
    description: 'Something else entirely',
    author: 'Jane Doe',
    namespace: 'acme'
  };

  it('should order the pairs longest-first', () => {
    const lengths = buildReplacements(answers).map(([from]) => from.length);

    // The ordering is the whole reason this is a list. "React App Fondation" contains words the
    // shorter rules would chew through first, leaving a string no later rule matches.
    expect(lengths).toEqual([...lengths].sort((a, b) => b - a));
  });

  it('should skip a field left at its template value', () => {
    const replacements = buildReplacements({ ...answers, author: TEMPLATE.author });

    expect(replacements.map(([from]) => from)).not.toContain(TEMPLATE.author);
  });

  it('should produce nothing when every answer is the default', () => {
    expect(buildReplacements({ ...TEMPLATE })).toEqual([]);
  });

  it('should quote the namespace so it only matches a whole value', () => {
    const sources = buildReplacements(answers).map(([from]) => from);

    // The namespace is `app`, which also appears in react-app-fondation, src/app/ and a hundred
    // other places. Only the quoted form is a value, so that's the only form we may match.
    expect(sources).toContain(`"${TEMPLATE.namespace}"`);
    expect(sources).not.toContain(TEMPLATE.namespace);
  });
});

describe('applyReplacements', () => {
  it('should rewrite every occurrence', () => {
    const replacements = buildReplacements({
      title: 'My Great App',
      slug: 'my-great-app',
      description: 'Something else',
      author: 'Jane Doe',
      namespace: 'app'
    });

    const before = `${TEMPLATE.title}, see ${TEMPLATE.slug}. ${TEMPLATE.title} again.`;
    const after = applyReplacements(before, replacements);

    expect(after).toBe('My Great App, see my-great-app. My Great App again.');
    expect(after).not.toContain(TEMPLATE.title);
    expect(after).not.toContain(TEMPLATE.slug);
  });

  it('should leave unrelated text alone', () => {
    const before = 'nothing here to rename';

    expect(applyReplacements(before, buildReplacements({ ...TEMPLATE }))).toBe(before);
  });

  it('should not partially rewrite the title into the slug', () => {
    const replacements = buildReplacements({
      title: 'Acme',
      slug: 'acme',
      description: TEMPLATE.description,
      author: TEMPLATE.author,
      namespace: TEMPLATE.namespace
    });

    expect(applyReplacements(TEMPLATE.title, replacements)).toBe('Acme');
    expect(applyReplacements(TEMPLATE.slug, replacements)).toBe('acme');
  });
});
