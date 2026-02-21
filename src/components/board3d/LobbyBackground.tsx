import React, { Suspense, useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { SceneryTrees } from './SceneryTrees';
import { SceneryGrass } from './SceneryGrass';
import { DroneModel, MouseModel } from './CharacterModel';

// Inline ground — same as game scene
const GrassGround: React.FC = () => {
  const { scene } = useGLTF('/3d/surface.glb');
  const texture = useMemo(() => {
    let tex: THREE.Texture | null = null;
    scene.traverse((child) => {
      if (tex) return;
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material;
        const source = (Array.isArray(mat) ? mat[0] : mat) as THREE.MeshStandardMaterial;
        if (source.map) {
          tex = source.map.clone();
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(10, 10);
          tex.needsUpdate = true;
        }
      }
    });
    return tex;
  }, [scene]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.5, -0.11, 3.5]}>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial map={texture ?? undefined} color={texture ? '#ffffff' : '#4a7c3f'} roughness={0.9} metalness={0} />
    </mesh>
  );
};

// Inline sun light — same as game scene
const SunLight: React.FC = () => {
  const ref = useRef<THREE.DirectionalLight>(null);
  const t = useRef(0);
  useFrame((_, d) => {
    if (!ref.current) return;
    t.current += d;
    ref.current.intensity = 1.3 + Math.sin(t.current * 0.2) * 0.1;
  });
  return (
    <directionalLight
      ref={ref}
      position={[10, 5, -8]}
      intensity={1.3}
      color="#ffd090"
      castShadow={false}
      shadow-mapSize-width={512}
      shadow-mapSize-height={512}
      shadow-camera-near={0.5}
      shadow-camera-far={50}
      shadow-camera-left={-15}
      shadow-camera-right={15}
      shadow-camera-top={15}
      shadow-camera-bottom={-15}
    />
  );
};

const LobbyAnimatedCharacters: React.FC = () => {
  const mouseGroupRef = useRef<THREE.Group>(null);
  const droneGroupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const state = useRef({
    phase: 'waiting' as 'waiting' | 'running',
    waitRemaining: 2,
    progress: 0,
    startX: 0, startZ: 0,
    endX: 7, endZ: 7,
    totalDist: 9.9,
    facing: 0,
    SPEED: 3.5,
  });

  useFrame((_, delta) => {
    const s = state.current;
    timeRef.current += delta;

    if (s.phase === 'waiting') {
      s.waitRemaining -= delta;
      if (s.waitRemaining > 0) return;

      // Generate a random path crossing the scene — wide range so characters stay visible longer
      const choice = Math.floor(Math.random() * 4);
      const jitter = () => -1 + Math.random() * 9;
      let sx: number, sz: number, ex: number, ez: number;
      switch (choice) {
        case 0: sx = -10; sz = jitter(); ex = 17; ez = jitter(); break;
        case 1: sx = 17; sz = jitter(); ex = -10; ez = jitter(); break;
        case 2: sx = jitter(); sz = -10; ex = jitter(); ez = 17; break;
        default: sx = jitter(); sz = 17; ex = jitter(); ez = -10; break;
      }
      s.startX = sx; s.startZ = sz;
      s.endX = ex; s.endZ = ez;
      const ddx = ex - sx; const ddz = ez - sz;
      s.totalDist = Math.sqrt(ddx * ddx + ddz * ddz);
      s.facing = Math.atan2(ex - sx, ez - sz);
      s.progress = 0;
      s.phase = 'running';
      return;
    }

    // Running phase
    s.progress += delta * (s.SPEED / s.totalDist);

    if (s.progress >= 1.05) {
      s.phase = 'waiting';
      s.waitRemaining = 6 + Math.random() * 8;
      if (mouseGroupRef.current) mouseGroupRef.current.visible = false;
      if (droneGroupRef.current) droneGroupRef.current.visible = false;
      return;
    }

    const t = Math.min(s.progress, 1);
    const mx = s.startX + (s.endX - s.startX) * t;
    const mz = s.startZ + (s.endZ - s.startZ) * t;

    if (mouseGroupRef.current) {
      mouseGroupRef.current.visible = true;
      mouseGroupRef.current.position.set(mx, 0.2, mz);
      mouseGroupRef.current.rotation.y = s.facing;
    }

    // Drone lags 1.5 units behind the mouse
    const lagFrac = 1.5 / s.totalDist;
    const lagProgress = Math.max(0, s.progress - lagFrac);
    const lagT = Math.min(lagProgress, 1);
    const droneVisible = lagProgress > 0;
    if (droneGroupRef.current) {
      droneGroupRef.current.visible = droneVisible;
      if (droneVisible) {
        const dx2 = s.startX + (s.endX - s.startX) * lagT;
        const dz2 = s.startZ + (s.endZ - s.startZ) * lagT;
        const bobY = 1.4 + Math.sin(timeRef.current * 2) * 0.04;
        droneGroupRef.current.position.set(dx2, bobY, dz2);
        droneGroupRef.current.rotation.y = s.facing;
      }
    }
  });

  return (
    <>
      <group ref={mouseGroupRef} visible={false}>
        <MouseModel ghost={false} animationName="rig|run cycle" />
      </group>
      <group ref={droneGroupRef} visible={false}>
        <DroneModel ghost={false} />
      </group>
    </>
  );
};

const LobbyScene: React.FC = () => (
  <>
    {/* Golden hour sky */}
    <Sky
      distance={450}
      sunPosition={[4, 1.5, -4]}
      inclination={0.48}
      azimuth={0.28}
      rayleigh={2.5}
      turbidity={10}
      mieCoefficient={0.004}
      mieDirectionalG={0.8}
    />

    {/* Lighting */}
    <ambientLight intensity={0.45} color="#ffe0b0" />
    <SunLight />
    <directionalLight position={[-5, 4, 6]} intensity={0.2} color="#8090cc" />
    <hemisphereLight color="#ffcc88" groundColor="#6b5040" intensity={0.45} />

    {/* Environment */}
    <GrassGround />
    <SceneryGrass />
    <SceneryTrees />

    {/* Animated characters passing through */}
    <LobbyAnimatedCharacters />

    {/* Atmospheric fog */}
    <fog attach="fog" args={['#ffd8a0', 16, 38]} />
  </>
);

export const LobbyBackground: React.FC = () => (
  <div style={{ width: '100%', height: '100%' }}>
    <Canvas
      camera={{ position: [3.5, 9, 11], fov: 70, near: 0.1, far: 500 }}
      style={{ background: 'transparent' }}
      gl={{ antialias: true, alpha: true }}
    >
      <Suspense fallback={null}>
        <LobbyScene />
      </Suspense>
      <OrbitControls
        target={[3.5, 0, 3.5]}
        enablePan={false}
        enableZoom={false}
        enableRotate={false}
        autoRotate
        autoRotateSpeed={0.4}
      />
    </Canvas>
  </div>
);
