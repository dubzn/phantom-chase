import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface QuestionMark3DProps {
  position: [number, number];
}

// Model is massively off-center: center ~(-960, -420, 0), size ~373x571x125
// Scale 0.0009 brings it to ~0.5 units tall
const QM_SCALE = 0.0009;
// Offset to re-center the geometry at origin
const QM_INNER_OFFSET: [number, number, number] = [960, 420, 0];

export const QuestionMark3D: React.FC<QuestionMark3DProps> = ({ position }) => {
  const { scene } = useGLTF('/3d/question_mark.glb');
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        mat.color = new THREE.Color('#ffd60a');
        mat.emissive = new THREE.Color('#ffd60a');
        mat.emissiveIntensity = 0.6;
        mat.transparent = true;
        mat.opacity = 0.8;
        mesh.material = mat;
      }
    });
    return c;
  }, [scene]);

  const groupRef = useRef<THREE.Group>(null);
  const currentPos = useRef(new THREE.Vector3(position[0], 0, position[1]));
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;

    // Lerp to target
    const target = new THREE.Vector3(position[0], 0, position[1]);
    currentPos.current.lerp(target, 0.08);

    const bobY = 0.8 + Math.sin(timeRef.current * 1.5) * 0.1;
    groupRef.current.position.set(
      currentPos.current.x,
      bobY,
      currentPos.current.z,
    );

    // Slow rotation
    groupRef.current.rotation.y += delta * 0.8;
  });

  return (
    <group ref={groupRef}>
      <group scale={[QM_SCALE, QM_SCALE, QM_SCALE]}>
        <group position={QM_INNER_OFFSET}>
          <primitive object={cloned} />
        </group>
      </group>
      <pointLight color="#ffd60a" intensity={0.6} distance={2} decay={2} />
    </group>
  );
};

useGLTF.preload('/3d/question_mark.glb');
