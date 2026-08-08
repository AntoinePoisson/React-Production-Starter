import useGlobalStore from '@/utils/store/Store';

/**
 * First-visit fade. Split out of Overlay so the store subscription is on a
 * single div — when the flag resolves, only this re-renders.
 */
export default function FirstVisitReveal({ className, children }: { className: string; children: React.ReactNode }) {
  // Read only. useBoot() is what actually sets the flag.
  const isFirstVisit = useGlobalStore((state) => state.isFirstVisit);

  return <div className={isFirstVisit ? `${className} enter-fade` : className}>{children}</div>;
}
