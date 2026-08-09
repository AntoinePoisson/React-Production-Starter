import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ClientOnly from '@/components/ClientOnly';

// Two properties matter, both about the prerender pass rather than the browser: the children
// must not be constructed on the server, and the first client render has to match the HTML.
describe('ClientOnly', () => {
  it('should render its children once mounted', () => {
    render(<ClientOnly>{() => <p>mounted</p>}</ClientOnly>);

    expect(screen.getByText('mounted')).toBeInTheDocument();
  });

  it('should not call the children function during the first render', () => {
    // The whole point. JSX evaluates its arguments eagerly, so <ClientOnly><Canvas /></...>
    // would construct the canvas during the server render. Taking a function makes that
    // impossible to get wrong.
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
