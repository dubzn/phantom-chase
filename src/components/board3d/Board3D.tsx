import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { BoardScene } from './BoardScene';

interface Board3DProps {
  map: number[];
  hunterPos: { x: number; y: number } | null;
  preyPos: { x: number; y: number } | null;
  preyVisible: boolean;
  preyFrozen: boolean;
  preyGhostPos: { x: number; y: number } | null;
  lastKnownPreyPos: { x: number; y: number } | null;
  searchedTiles: Array<{ x: number; y: number }>;
  validMoves: Set<string>;
  selectedTile: { x: number; y: number } | null;
  onTileClick: (x: number, y: number, screenX: number, screenY: number) => void;
  onTileRightClick: (x: number, y: number) => void;
}

const LoadingFallback = () => (
  <mesh position={[3.5, 0, 3.5]}>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial color="#333" wireframe />
  </mesh>
);

export const Board3D: React.FC<Board3DProps> = (props) => {
  return (
    <div
      style={{ width: '100%', height: '100%' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        camera={{
          position: [3.5, 9, 9],
          fov: 55,
          near: 0.1,
          far: 500,
        }}
        shadows
        style={{ background: 'transparent' }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <BoardScene {...props} />
        </Suspense>
        <OrbitControls
          target={[3.5, 0.5, 3.5]}
          enablePan={false}
          enableZoom
          minDistance={4}
          maxDistance={22}
          minPolarAngle={Math.PI / 12}
          maxPolarAngle={Math.PI / 2.2}
          zoomSpeed={0.8}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
    </div>
  );
};
