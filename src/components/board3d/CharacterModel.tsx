import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';

interface CharacterModelProps {
  position: [number, number];
  type: 'hunter' | 'prey';
  visible: boolean;
  ghost?: boolean;
}

// dron.glb: bbox ~2.82 x 0.74 x 2.16, centered near origin
const DRONE_SCALE = 0.8;

// mouse.glb: bbox ~0.89 x 4.92 x 1.17, skinned mesh
const MOUSE_SCALE = 0.3;

export const DroneModel: React.FC<{ ghost: boolean }> = ({ ghost }) => {
  const { scene, animations } = useGLTF('/3d/drone_2.glb');
  const cloned = useMemo(() => {
    const c = SkeletonUtils.clone(scene);
    c.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const clonedMats = mats.map((m) => {
        const cm = m.clone();
        if (cm instanceof THREE.MeshStandardMaterial) {
          cm.color.set('#8c918c');
          cm.metalness = 0.5;
          cm.roughness = 0.3;
        }
        cm.needsUpdate = true;
        return cm;
      });
      mesh.material = Array.isArray(mesh.material) ? clonedMats : clonedMats[0];
    });
    return c;
  }, [scene]);
  const groupRef = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, groupRef);

  useEffect(() => {
    const action = actions['Vole stationnaire'] || Object.values(actions)[0];
    if (action) {
      action.reset().play();
      action.setLoop(THREE.LoopRepeat, Infinity);
    }
    return () => { action?.stop(); };
  }, [actions]);

  useEffect(() => {
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          m.transparent = ghost;
          m.opacity = ghost ? 0.35 : 1;
        });
      }
    });
  }, [cloned, ghost]);

  return (
    <group ref={groupRef} scale={[DRONE_SCALE, DRONE_SCALE, DRONE_SCALE]}>
      <primitive object={cloned} />
    </group>
  );
};

export const MouseModel: React.FC<{ ghost: boolean; animationName?: string }> = ({ ghost, animationName }) => {
  const { scene, animations } = useGLTF('/3d/mouse.glb');
  const cloned = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const groupRef = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, groupRef);

  useEffect(() => {
    const action = (animationName ? actions[animationName] : null)
      ?? actions['rig|idol animtion']
      ?? Object.values(actions)[0];
    if (action) {
      action.reset().play();
      action.setLoop(THREE.LoopRepeat, Infinity);
    }
    return () => { action?.stop(); };
  }, [actions, animationName]);

  useEffect(() => {
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          m.transparent = ghost;
          m.opacity = ghost ? 0.35 : 1;
        });
      }
    });
  }, [cloned, ghost]);

  return (
    <group ref={groupRef}>
      <group scale={[MOUSE_SCALE, MOUSE_SCALE, MOUSE_SCALE]} rotation={[0, 0, 0]}>
        <primitive object={cloned} />
      </group>
    </group>
  );
};

export const CharacterModel: React.FC<CharacterModelProps> = ({
  position,
  type,
  visible,
  ghost = false,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const currentPos = useRef(new THREE.Vector3(position[0], 0, position[1]));
  const timeRef = useRef(0);
  // Track target rotation (Y-axis) and current smoothed rotation
  const targetRotation = useRef(0);
  const currentRotation = useRef(0);
  const prevTarget = useRef<[number, number]>(position);

  const color = type === 'hunter' ? '#ff6961' : '#64d2ff';
  const yBase = type === 'hunter' ? 1.4 : 0.2;

  const isPrey = type === 'prey';

  // Detect position change and compute target facing angle (both hunter and prey)
  if (position[0] !== prevTarget.current[0] || position[1] !== prevTarget.current[1]) {
    const dx = position[0] - prevTarget.current[0];
    const dz = position[1] - prevTarget.current[1];
    targetRotation.current = Math.atan2(dx, dz);
    prevTarget.current = position;
  }

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;

    // Smoothly rotate towards target direction
    let angleDiff = targetRotation.current - currentRotation.current;
    // Normalize to [-PI, PI] for shortest path
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    currentRotation.current += angleDiff * Math.min(delta * 3, 1);
    groupRef.current.rotation.y = currentRotation.current;

    // Smooth position transition
    const target = new THREE.Vector3(position[0], 0, position[1]);
    currentPos.current.lerp(target, isPrey ? 0.05 : 0.08);

    const bobY = yBase + Math.sin(timeRef.current * 2) * 0.03;
    groupRef.current.position.set(
      currentPos.current.x,
      bobY,
      currentPos.current.z,
    );
  });

  if (!visible) return null;

  return (
    <group ref={groupRef}>
      {type === 'hunter' ? (
        <DroneModel ghost={ghost} />
      ) : (
        <MouseModel ghost={ghost} />
      )}
      <pointLight
        color={color}
        intensity={ghost ? 0.3 : 0.8}
        distance={2.5}
        decay={2}
      />
    </group>
  );
};

useGLTF.preload('/3d/drone_2.glb');
useGLTF.preload('/3d/mouse.glb');
