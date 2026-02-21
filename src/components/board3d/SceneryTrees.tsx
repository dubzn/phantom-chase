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
        mat.alphaTest = 0.5;
        mat.side = THREE.DoubleSide;
        mat.needsUpdate = true;
      });
    }
  });
}

export const SceneryTrees: React.FC = () => {
  const { scene } = useGLTF('/3d/tree_animate.glb');

  const trees = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => {
      const angle = (i / 20) * Math.PI * 2 + seededRandom(i * 17) * 0.5;
      const radius = 7.5 + seededRandom(i * 31) * 5;
      const scale = 0.4 + seededRandom(i * 13) * 0.1;
      const rotY = seededRandom(i * 7) * Math.PI * 2;
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
      {trees.map((t, i) => (
        <primitive
          key={i}
          object={t.cloned}
          position={[t.x, 0, t.z]}
          scale={[t.scale, t.scale, t.scale]}
          rotation={[0, t.rotY, 0]}
        />
      ))}
    </>
  );
};

useGLTF.preload('/3d/tree_animate.glb');
