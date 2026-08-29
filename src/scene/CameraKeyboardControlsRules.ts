import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

const ORBIT_STEP = Math.PI / 18;

/** One key → camera move. Pure so we can unit-test it. */
export const applyCameraKey = (key: string, controls: OrbitControlsImpl): boolean => {
  switch (key) {
    case 'ArrowLeft':
      controls.setAzimuthalAngle(controls.getAzimuthalAngle() - ORBIT_STEP);
      break;
    case 'ArrowRight':
      controls.setAzimuthalAngle(controls.getAzimuthalAngle() + ORBIT_STEP);
      break;
    case 'ArrowUp':
      controls.setPolarAngle(controls.getPolarAngle() - ORBIT_STEP);
      break;
    case 'ArrowDown':
      controls.setPolarAngle(controls.getPolarAngle() + ORBIT_STEP);
      break;
    case '+':
    case '=':
      controls.dollyIn();
      break;
    case '-':
    case '_':
      controls.dollyOut();
      break;
    case 'Home':
      controls.reset();
      break;
    default:
      return false;
  }

  controls.update();
  return true;
};
