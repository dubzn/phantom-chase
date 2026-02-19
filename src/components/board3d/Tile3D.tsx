import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

// Load textures once, shared by all tiles
const GRASS_PATH = '/3d/grass.jpg';
const GRASS_DENSE_PATH = '/3d/grass_dense.jpg';

interface Tile3DProps {
  x: number;
  y: number;
  isJungle: boolean;
  isSearched: boolean;
  isValidMove: boolean;
  isSelected: boolean;
  onClick: (x: number, y: number, screenX: number, screenY: number) => void;
  onRightClick: (x: number, y: number) => void;
}

export const Tile3D: React.FC<Tile3DProps> = ({
  x,
  y,
  isJungle,
  isSearched,
  isValidMove,
  isSelected,
  onClick,
  onRightClick,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const timeRef = useRef(0);

  const height = isJungle ? 0.14 : 0.1;

  const grassTex = useTexture(GRASS_PATH);
  const grassDenseTex = useTexture(GRASS_DENSE_PATH);

  const texture = isJungle ? grassDenseTex : grassTex;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;

    if (isSelected) {
      mat.emissive.set('#64d2ff');
      mat.emissiveIntensity = 0.4;
    } else if (isSearched) {
      mat.emissive.set('#ffd60a');
      mat.emissiveIntensity = 0.2 + Math.sin(timeRef.current * 3) * 0.15;
    } else if (isValidMove) {
      mat.emissive.set('#ffffff');
      mat.emissiveIntensity = 0.08 + Math.sin(timeRef.current * 2.5) * 0.06;
    } else if (hovered) {
      mat.emissive.set('#ffffff');
      mat.emissiveIntensity = 0.1;
    } else {
      mat.emissiveIntensity = 0;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[x, height / 2, y]}
      onClick={(e) => {
        e.stopPropagation();
        onClick(x, y, e.clientX, e.clientY);
      }}
      onContextMenu={(e) => {
        e.stopPropagation();
        onRightClick(x, y);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = isValidMove ? 'pointer' : 'default';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      <boxGeometry args={[0.92, height, 0.92]} />
      <meshStandardMaterial
        map={texture}
        color={isJungle ? '#3c913c' : '#d4c5a9'}
        roughness={0.85}
        metalness={0.05}
      />
    </mesh>
  );
};

useTexture.preload(GRASS_PATH);
useTexture.preload(GRASS_DENSE_PATH);
