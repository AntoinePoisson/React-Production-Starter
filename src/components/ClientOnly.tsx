import { type ReactNode, useEffect, useState } from 'react';

/**
 * Takes a function and not an element. JSX evaluates its arguments eagerly, so
 * <ClientOnly><Canvas /></ClientOnly> would build the canvas during the server render, which is
 * the exact thing this is here to prevent.
 */
export default function ClientOnly({ children, fallback = null }: { children: () => ReactNode; fallback?: ReactNode }) {
  // false on the first client render too, hydration compares against the prerendered HTML.
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return <>{mounted ? children() : fallback}</>;
}
