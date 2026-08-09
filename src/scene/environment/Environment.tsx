import { sceneColor } from '@/utils/theme/Palette';

const SUN_POSITION: [number, number, number] = [12, 14, 8];

const SHADOW_MAP_SIZE = 1024;

/**
 * Lights + ground. No <Sky /> — that was ~8ms/frame here, fill-rate bound
 * where mobile GPUs already struggle. Gradient is CSS. Bring Sky back if
 * you need a sun disc or a day/night cycle.
 */
export default function Environment() {
  return (
    <>
      {/* Keep the fill low or the shadows disappear. */}
      <ambientLight intensity={0.45} />

      {/* Tight frustum so the shadow map isn't wasted on empty space. */}
      <directionalLight
        castShadow
        intensity={2.6}
        position={SUN_POSITION}
        shadow-bias={-0.0005}
        shadow-camera-bottom={-7}
        shadow-camera-far={40}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-mapSize-height={SHADOW_MAP_SIZE}
        shadow-mapSize-width={SHADOW_MAP_SIZE}
      />

      <mesh
        receiveShadow
        position={[0, -2.2, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[16, 48]} />
        <meshStandardMaterial
          color={sceneColor('floor')}
          roughness={0.95}
        />
      </mesh>
    </>
  );
}
