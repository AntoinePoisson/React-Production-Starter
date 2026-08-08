import { type ReactNode, useEffect, useState } from 'react';

/**
 * Takes a function, not an element. JSX evaluates children eagerly, so
 * <ClientOnly><Canvas /></ClientOnly> would build the canvas on the server.
 */
export default function ClientOnly({ children, fallback = null }: { children: () => ReactNode; fallback?: ReactNode }) {
  // false on the first client render too — hydration compares against the prerendered HTML.
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return <>{mounted ? children() : fallback}</>;
}
