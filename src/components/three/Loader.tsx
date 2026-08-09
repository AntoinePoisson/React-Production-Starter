import { useLingui } from '@lingui/react/macro';
import { Html, useProgress } from '@react-three/drei';

const useProgressLabel = (): string => {
  const { t } = useLingui();
  const { progress } = useProgress();
  const percent = Math.round(progress);

  return t`${percent}% loaded`;
};

export function InsideCanvasLoader() {
  return (
    <Html center>
      <p className='text-ink-muted text-sm'>{useProgressLabel()}</p>
    </Html>
  );
}

/**
 * Shown while the canvas chunk downloads.
 *
 * Only import this from inside the lazy canvas (drei is already paid for).
 * The shell uses BootLoader.tsx.
 */
export default function CanvasLoader() {
  return (
    <div className='fixed inset-0 flex items-center justify-center'>
      <p className='text-ink-muted text-sm'>{useProgressLabel()}</p>
    </div>
  );
}
