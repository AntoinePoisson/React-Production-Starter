import useGlobalStore from '@/utils/store/Store';

/**
 * Entrance animation, first visit only. Split out of <Overlay> so the store subscription sits on
 * a wrapper that renders a single div: when the flag resolves, only this element re-renders.
 */
export default function FirstVisitReveal({ className, children }: { className: string; children: React.ReactNode }) {
  // Read only, useBoot() is what resolves the flag.
  const isFirstVisit = useGlobalStore((state) => state.isFirstVisit);

  return <div className={isFirstVisit ? `${className} enter-fade` : className}>{children}</div>;
}
