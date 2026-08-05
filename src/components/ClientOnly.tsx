import { type ReactNode, useEffect, useState } from 'react';

/**
 * Renders its children in the browser only — the 3D canvas needs a WebGL context, and the
 * pre-render runs in Node. The overlay is deliberately not wrapped: that copy in the HTML is
 * what paints before the 3D bundle arrives.
 *
 * `children` is a function, not an element: JSX evaluates its arguments eagerly, so
 * `<ClientOnly><Canvas /></ClientOnly>` would build the canvas during the server render.
 */
export default function ClientOnly({ children, fallback = null }: { children: () => ReactNode; fallback?: ReactNode }) {
  // `false` on the first client render too — hydration compares against the pre-rendered HTML.
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return <>{mounted ? children() : fallback}</>;
}
