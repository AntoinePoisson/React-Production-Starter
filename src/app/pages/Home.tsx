import Overlay from '@/components/ui/Overlay';

// Only the DOM overlay. The canvas is mounted by the root shell, see routes/__root.tsx.
export default function Home() {
  return <Overlay />;
}
