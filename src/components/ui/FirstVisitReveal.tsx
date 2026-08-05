import useGlobalStore from '@/utils/store/Store';

/**
 * Plays the entrance animation on a first visit only. Its own component so the store subscription
 * sits on a wrapper rendering one `<div>` rather than on `<Overlay>`: when the flag resolves,
 * Zustand re-renders only this element. Children come from the caller and never re-render.
 */
export default function FirstVisitReveal({ className, children }: { className: string; children: React.ReactNode }) {
  // Read only; resolving the flag is `app/Providers.tsx`'s job.
  const isFirstVisit = useGlobalStore((state) => state.isFirstVisit);

  return <div className={isFirstVisit ? `${className} enter-fade-up` : className}>{children}</div>;
}
