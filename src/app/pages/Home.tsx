import Overlay from '@/components/ui/Overlay';

/**
 * The DOM overlay above the canvas. The canvas itself is mounted by the root shell — see the
 * comment in `src/routes/__root.tsx`.
 */
export default function Home() {
  return <Overlay />;
}
