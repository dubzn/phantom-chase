import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

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

// Extract the nth MeshStandardMaterial found while traversing a GLB scene
function getNthMaterial(scene: THREE.Object3D, n: number): THREE.MeshStandardMaterial | null {
  let count = 0;
  let found: THREE.MeshStandardMaterial | null = null;
  scene.traverse((child) => {
    if (found) return;
    if ((child as THREE.Mesh).isMesh) {
      const raw = (child as THREE.Mesh).material;
      const m = (Array.isArray(raw) ? raw[0] : raw) as THREE.Material;
      if (m instanceof THREE.MeshStandardMaterial) {
        if (count === n) found = m;
        count++;
      }
    }
  });
  return found;
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

  const { scene } = useGLTF('/3d/surface.glb');

  // Clone the surface material for this tile so emissive state is independent
  // index 0 = first grass (open tiles), index 1 = second grass (jungle tiles)
  const tileMat = useMemo(() => {
    const base = getNthMaterial(scene, isJungle ? 2 : 0);
    if (!base) return null;
    const cloned = base.clone();
    cloned.roughness = 0.9;
    cloned.metalness = 0.02;
    cloned.needsUpdate = true;
    return cloned;
  }, [scene, isJungle]);

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
      receiveShadow
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
      {tileMat ? (
        <primitive object={tileMat} attach="material" />
      ) : (
        <meshStandardMaterial
          color={isJungle ? '#3c913c' : '#d4c5a9'}
          roughness={0.85}
          metalness={0.05}
        />
      )}
    </mesh>
  );
};

useGLTF.preload('/3d/surface.glb');
