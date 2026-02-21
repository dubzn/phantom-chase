import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';

function seededRandom(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function fixMaterials(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        mat.transparent = false;
        mat.depthWrite = true;
        mat.alphaTest = 0.4;
        mat.side = THREE.DoubleSide;
        mat.needsUpdate = true;
      });
    }
  });
}

export const SceneryGrass: React.FC = () => {
  const { scene } = useGLTF('/3d/grass.glb');

  const patches = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => {
      // Inner ring closer to the board: radius 4.5–9
      const angle = (i / 18) * Math.PI * 2 + seededRandom(i * 23) * 0.7;
      const radius = 8 + seededRandom(i * 41) * 4.5;
      const scale = 0.4 + seededRandom(i * 19) * 0.45;
      const rotY = seededRandom(i * 11) * Math.PI * 2;
      const cloned = SkeletonUtils.clone(scene);
      fixMaterials(cloned);
      return {
        cloned,
        x: 3.5 + Math.cos(angle) * radius,
        z: 3.5 + Math.sin(angle) * radius,
        scale,
        rotY,
      };
    });
  }, [scene]);

  return (
    <>
      {patches.map((p, i) => (
        <primitive
          key={i}
          object={p.cloned}
          position={[p.x, 0, p.z]}
          scale={[p.scale, p.scale, p.scale]}
          rotation={[0, p.rotY, 0]}
        />
      ))}
    </>
  );
};

useGLTF.preload('/3d/grass.glb');
