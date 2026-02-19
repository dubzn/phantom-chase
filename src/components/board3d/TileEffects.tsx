import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SearchPulseProps {
  x: number;
  y: number;
}

const SearchPulse: React.FC<SearchPulseProps> = ({ x, y }) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (!ringRef.current) return;
    timeRef.current += delta;

    const scale = 1 + Math.sin(timeRef.current * 2) * 0.3;
    ringRef.current.scale.set(scale, 1, scale);

    const mat = ringRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = 0.3 + Math.sin(timeRef.current * 2) * 0.2;
  });

  return (
    <mesh ref={ringRef} position={[x, 0.02, y]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.35, 0.45, 32]} />
      <meshStandardMaterial
        color="#ffd60a"
        emissive="#ffd60a"
        emissiveIntensity={0.5}
        transparent
        opacity={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

interface TileEffectsProps {
  searchedTiles: Array<{ x: number; y: number }>;
}

export const TileEffects: React.FC<TileEffectsProps> = ({ searchedTiles }) => {
  return (
    <group>
      {searchedTiles.map((tile, i) => (
        <SearchPulse key={`search-${i}`} x={tile.x} y={tile.y} />
      ))}
    </group>
  );
};
