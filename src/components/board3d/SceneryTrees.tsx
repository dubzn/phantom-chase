import React, { useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';

function seededRandom(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// tree_animate.glb material names: Bark (Object_4), Leaf (mesh_1), Branch (mesh_1_1)
const LEAF_COLORS = ['#2d6e2d', '#357a2f', '#3a8033', '#2a5e28', '#4a8c3a'];

function fixMaterials(obj: THREE.Object3D, seed: number) {
  obj.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;

    // Clone materials so each tree instance is fully independent
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((m) => m.clone())
      : (mesh.material as THREE.Material).clone();

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    mats.forEach((mat) => {
      const matName = mat.name ?? '';
      mat.side = THREE.DoubleSide;
      mat.depthWrite = true;
      mat.needsUpdate = true;

      if (!(mat instanceof THREE.MeshStandardMaterial)) return;

      if (matName === 'Bark') {
        mat.color.set('#5c3d1e');
        mat.roughness = 0.95;
        mat.metalness = 0;
      } else if (matName === 'Branch') {
        mat.color.set('#4a3018');
        mat.roughness = 0.9;
        mat.metalness = 0;
      } else if (matName === 'Leaf') {
        mat.color.set(LEAF_COLORS[seed % LEAF_COLORS.length]);
        mat.roughness = 0.8;
        mat.metalness = 0;
        mat.alphaTest = 0.4;
        mat.transparent = false;
      }
    });
  });
}

// Collect all unique materials from a cloned tree (called once at setup)
function collectMaterials(obj: THREE.Object3D): THREE.Material[] {
  const mats: THREE.Material[] = [];
  obj.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const m = (child as THREE.Mesh).material;
    const arr = Array.isArray(m) ? m : [m];
    arr.forEach((mat) => { if (!mats.includes(mat)) mats.push(mat); });
  });
  return mats;
}

const BOARD_CENTER = new THREE.Vector3(3.5, 0.5, 3.5);
const DOT_THRESHOLD = 0.20;
const FADE_SPEED = 5;

const _camToBoard = new THREE.Vector3();
const _camToTree = new THREE.Vector3();

export const SceneryTrees: React.FC = () => {
  const { scene } = useGLTF('/3d/tree_animate.glb');

  const trees = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => {
      const angle = (i / 20) * Math.PI * 2 + seededRandom(i * 17) * 0.5;
      const radius = 32 + seededRandom(i * 31) * 5;
      const scale = 0.15 + seededRandom(i * 13) * 0.02;
      const rotY = seededRandom(i * 7) * Math.PI * 2;
      const cloned = SkeletonUtils.clone(scene);
      fixMaterials(cloned, i);
      return {
        cloned,
        materials: collectMaterials(cloned), // pre-collected — no traverse in useFrame
        x: 3.5 + Math.cos(angle) * radius,
        z: 3.5 + Math.sin(angle) * radius,
        scale,
        rotY,
      };
    });
  }, [scene]);

  const opacities = useRef<number[]>(trees.map(() => 1));
  const groupRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame(({ camera }, delta) => {
    _camToBoard.copy(BOARD_CENTER).sub(camera.position).normalize();

    trees.forEach((t, i) => {
      const group = groupRefs.current[i];
      if (!group) return;

      _camToTree.set(t.x, 0, t.z).sub(camera.position).normalize();
      const dot = _camToBoard.dot(_camToTree);

      const target = dot > DOT_THRESHOLD ? 1.0 : 0.0;
      const current = opacities.current[i];
      if (Math.abs(target - current) < 0.001) return; // stable — skip

      // Make visible before fading in
      if (target === 1.0 && !group.visible) group.visible = true;

      const next = current + (target - current) * Math.min(delta * FADE_SPEED, 1);
      opacities.current[i] = next;

      t.materials.forEach((mat) => {
        mat.transparent = true;
        mat.opacity = next;
        mat.depthWrite = next > 0.5;
      });

      // Fully hidden — stop rendering
      if (next < 0.01) {
        group.visible = false;
        t.materials.forEach((mat) => { mat.transparent = false; mat.opacity = 1; mat.depthWrite = true; });
      }
      // Fully visible — restore clean state
      if (next > 0.99) {
        t.materials.forEach((mat) => { mat.transparent = false; mat.opacity = 1; mat.depthWrite = true; });
      }
    });
  });

  return (
    <>
      {trees.map((t, i) => (
        <group
          key={i}
          ref={(el) => { groupRefs.current[i] = el; }}
          position={[t.x, 0, t.z]}
          scale={[t.scale, t.scale, t.scale]}
          rotation={[0, t.rotY, 0]}
        >
          <primitive object={t.cloned} />
        </group>
      ))}
    </>
  );
};

useGLTF.preload('/3d/tree_animate.glb');
