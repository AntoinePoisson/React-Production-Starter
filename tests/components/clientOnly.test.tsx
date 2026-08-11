import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ClientOnly from '@/components/ClientOnly';

// Two things: children must not run on the server, and the first client
// render has to match the prerendered HTML.
describe('ClientOnly', () => {
  it('should render its children once mounted', () => {
    render(<ClientOnly>{() => <p>mounted</p>}</ClientOnly>);

    expect(screen.getByText('mounted')).toBeInTheDocument();
  });

  it('should not call the children function during the first render', () => {
    // JSX evaluates children eagerly. A function is the only way this stays honest.
    const children = vi.fn(() => <p>scene</p>);
    let callsBeforeEffects = -1;

    const Probe = () => {
      callsBeforeEffects = children.mock.calls.length;
      return null;
    };

    render(
      <>
        <Probe />
        <ClientOnly>{children}</ClientOnly>
      </>
    );

    expect(callsBeforeEffects).toBe(0);
  });

  it('should show the fallback until mounted, then replace it', () => {
    render(<ClientOnly fallback={<p>loading</p>}>{() => <p>scene</p>}</ClientOnly>);

    expect(screen.queryByText('loading')).not.toBeInTheDocument();
    expect(screen.getByText('scene')).toBeInTheDocument();
  });

  it('should render nothing when no fallback is given', () => {
    const { container } = render(<ClientOnly>{() => null}</ClientOnly>);

    expect(container).toBeEmptyDOMElement();
  });
});
