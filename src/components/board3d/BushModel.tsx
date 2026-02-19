import React, { useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';

interface BushModelProps {
  position: [number, number, number];
  scale?: number;
  rotation?: number;
  variant?: 2 | 3;
  occupied?: boolean; // prey is standing on this bush
}

const VARIANT_SCALES: Record<number, number> = {
  1: 1,
  2: 0.007,
  3: 0.008,
};

function fixMaterials(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        mat.transparent = false;
        mat.depthWrite = true;
        mat.alphaTest = 0.5;
        mat.side = THREE.FrontSide;
      });
    }
  });
}

const BushVariant: React.FC<BushModelProps & { path: string }> = ({
  position,
  scale = 1.5,
  rotation = 0,
  variant = 1,
  occupied = false,
  path,
}) => {
  const { scene } = useGLTF(path);
  const cloned = useMemo(() => {
    const c = SkeletonUtils.clone(scene);
    fixMaterials(c);
    return c;
  }, [scene]);

  const groupRef = useRef<THREE.Group>(null);
  const currentScaleY = useRef(1);
  const currentOpacity = useRef(1);

  const baseScale = scale * VARIANT_SCALES[variant];

  // Smoothly lerp scale and opacity when occupied changes
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const targetScaleY = occupied ? 0.3 : 1;
    const targetOpacity = occupied ? 0.25 : 1;
    const speed = delta * 4;

    currentScaleY.current += (targetScaleY - currentScaleY.current) * speed;
    currentOpacity.current += (targetOpacity - currentOpacity.current) * speed;

    groupRef.current.scale.set(baseScale, baseScale * currentScaleY.current, baseScale);

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((mat) => {
          mat.transparent = currentOpacity.current < 0.99;
          mat.opacity = currentOpacity.current;
          mat.depthWrite = currentOpacity.current > 0.5;
        });
      }
    });
  });

  return (
    <group ref={groupRef} position={position} rotation={[0, rotation, 0]} scale={baseScale}>
      <primitive object={cloned} />
    </group>
  );
};

export const BushModel: React.FC<BushModelProps> = (props) => {
  const v = props.variant ?? 2;
  const path = `/3d/bush_${v}.glb`;
  return <BushVariant {...props} variant={v} path={path} />;
};

useGLTF.preload('/3d/bush_1.glb');
useGLTF.preload('/3d/bush_2.glb');
useGLTF.preload('/3d/bush_3.glb');
