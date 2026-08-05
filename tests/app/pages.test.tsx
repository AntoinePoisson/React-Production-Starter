import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { withI18n } from '../helpers/withI18n';

const invalidate = vi.fn();

// The router is a mount-time context, and these pages are exactly the ones rendered when it is
// in an unusual state. Stubbing it keeps each assertion about the page.
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate }),
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a
      href={to}
      {...props}
    >
      {children}
    </a>
  )
}));

const { default: ErrorPage } = await import('@/app/pages/ErrorPage');
const { default: Loading } = await import('@/app/pages/Loading');
const { default: NotFound } = await import('@/app/pages/NotFound');

describe('ErrorPage', () => {
  it('should offer a way out', () => {
    render(withI18n(<ErrorPage error={new Error('boom')} />));

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));

    // `invalidate()` re-runs the failed match; a reload would destroy the WebGL context and
    // rebuild it — three.js re-parsed, camera back to its starting position.
    expect(invalidate).toHaveBeenCalled();
  });

  it('should translate its copy', () => {
    const { unmount } = render(withI18n(<ErrorPage error={new Error('boom')} />, 'en'));
    const english = screen.getByRole('heading', { level: 1 }).textContent;
    unmount();

    render(withI18n(<ErrorPage error={new Error('boom')} />, 'fr'));

    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toBe(english);
  });
});

describe('Loading', () => {
  it('should render translated copy', () => {
    render(withI18n(<Loading />, 'fr'));

    expect(screen.getByText('Chargement…')).toBeInTheDocument();
  });
});

describe('NotFound', () => {
  it('should carry its own title', () => {
    // A document reached this way never ran a route's `head`, so the tag is rendered inline —
    // and React 19 hoists it out of the component and into <head>, which is why this looks
    // there rather than in the render container.
    render(withI18n(<NotFound />));

    expect(document.head.querySelector('title')).not.toBeNull();
  });

  it('should link back to the home page', () => {
    render(withI18n(<NotFound />));

    expect(screen.getByRole('link')).toHaveAttribute('href', '/');
  });

  it('should translate its copy', () => {
    render(withI18n(<NotFound />, 'fr'));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Page introuvable');
  });
});
