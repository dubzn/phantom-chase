import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { BoardBackground } from './BoardBackground';

const LobbyScene: React.FC = () => (
  <>
    <ambientLight intensity={0.2} />
    <directionalLight position={[8, 14, 6]} intensity={0.9} color="#fff8ee" />
    <directionalLight position={[-6, 7, -9]} intensity={0.3} color="#4488cc" />
    <hemisphereLight color="#c8e8ff" groundColor="#050510" intensity={0.25} />
    <pointLight position={[3.5, 0.3, 3.5]} intensity={0.5} color="#0a2060" distance={7} decay={2} />
    <BoardBackground />
    <fog attach="fog" args={['#000000', 10, 22]} />
  </>
);

export const LobbyBackground: React.FC = () => (
  <div style={{ width: '100%', height: '100%' }}>
    <Canvas
      camera={{ position: [3.5, 5, 10], fov: 35, near: 0.1, far: 40 }}
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
        autoRotateSpeed={0.3}
      />
    </Canvas>
  </div>
);
