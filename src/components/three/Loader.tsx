import { useLingui } from '@lingui/react/macro';
import { Html, useProgress } from '@react-three/drei';

const useProgressLabel = (): string => {
  const { t } = useLingui();
  const { progress } = useProgress();
  const percent = Math.round(progress);

  return t`${percent}% loaded`;
};

/** Loader rendered *inside* the canvas (3D space) — use it in a <Suspense> within the scene. */
export function InsideCanvasLoader() {
  return (
    <Html center>
      <p className='text-ink-muted text-sm'>{useProgressLabel()}</p>
    </Html>
  );
}

/**
 * Loader rendered *instead of* the canvas — the fallback while the scene's own chunk arrives.
 *
 * Only ever import this from inside the lazily loaded canvas, where drei is already paid for.
 * From the document shell, use `components/ui/BootLoader.tsx`.
 */
export default function CanvasLoader() {
  return (
    <div className='fixed inset-0 flex items-center justify-center'>
      <p className='text-ink-muted text-sm'>{useProgressLabel()}</p>
    </div>
  );
}
