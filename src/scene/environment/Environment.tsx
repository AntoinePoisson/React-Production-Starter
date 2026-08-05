import { sceneColor } from '@/utils/theme/Palette';

const SUN_POSITION: [number, number, number] = [12, 14, 8];

/** Crisp enough at this scene scale, cheap on mobile GPUs. */
const SHADOW_MAP_SIZE = 1024;

/**
 * Lights and ground. No sky object: drei's <Sky /> costs ~8 ms per frame here and is fill-rate
 * bound where mobile GPUs are weakest, so the gradient is CSS (--color-sky-* in globals.css).
 * Add <Sky /> back only for a sun disc or a day/night cycle.
 */
export default function Environment() {
  return (
    <>
      {/* Keep the fill low, or the shadows stop reading. */}
      <ambientLight intensity={0.45} />

      {/* Tight shadow frustum: more texels land on what is visible. */}
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
