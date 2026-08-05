import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Home from '@/app/pages/Home';

import { withI18n } from '../helpers/withI18n';

/**
 * The landing page is the overlay and nothing else. The canvas is mounted by the root shell —
 * see `tests/app/rootRoute.test.tsx` for why, and for the test that keeps it there.
 */
describe('Home', () => {
  it('should render the overlay copy', () => {
    render(withI18n(<Home />));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('React App Fondation');
  });

  it('should be pre-renderable, with nothing client-only in it', () => {
    const { container } = render(withI18n(<Home />));

    // The overlay must be in the pre-rendered HTML: it is the text a crawler indexes and the
    // pixels a visitor sees before the 3D bundle has downloaded. Nothing here may wait for the
    // browser — a `<ClientOnly>` around any of it would cost exactly that.
    expect(container.querySelector('header')).not.toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('should render the language switcher', () => {
    render(withI18n(<Home />));

    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
