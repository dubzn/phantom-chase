import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT_OUTER = 160;
const PARTICLE_COUNT_INNER = 60;

const GlowPlane: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.18 + Math.sin(timeRef.current * 0.6) * 0.06;
  });

  return (
    <mesh ref={meshRef} position={[3.5, -0.12, 3.5]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[12, 12]} />
      <meshStandardMaterial
        color="#000510"
        emissive="#0a1a40"
        emissiveIntensity={0.18}
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </mesh>
  );
};

const EdgeGlow: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.25 + Math.sin(timeRef.current * 0.8) * 0.1;
  });

  return (
    <mesh ref={meshRef} position={[3.5, -0.09, 3.5]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[5.5, 8.5, 64]} />
      <meshStandardMaterial
        color="#000000"
        emissive="#112244"
        emissiveIntensity={0.25}
        transparent
        opacity={0.5}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
};

export const BoardBackground: React.FC = () => {
  const outerRef = useRef<THREE.Points>(null);
  const innerRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  const outer = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT_OUTER * 3);
    const spd = new Float32Array(PARTICLE_COUNT_OUTER);
    for (let i = 0; i < PARTICLE_COUNT_OUTER; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 6 + Math.random() * 9;
      const height = -0.5 + Math.random() * 7;
      pos[i * 3] = 3.5 + Math.cos(angle) * radius;
      pos[i * 3 + 1] = height;
      pos[i * 3 + 2] = 3.5 + Math.sin(angle) * radius;
      spd[i] = 0.15 + Math.random() * 0.4;
    }
    return { positions: pos, speeds: spd };
  }, []);

  const inner = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT_INNER * 3);
    const spd = new Float32Array(PARTICLE_COUNT_INNER);
    for (let i = 0; i < PARTICLE_COUNT_INNER; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2 + Math.random() * 4;
      const height = 0.2 + Math.random() * 3;
      pos[i * 3] = 3.5 + Math.cos(angle) * radius;
      pos[i * 3 + 1] = height;
      pos[i * 3 + 2] = 3.5 + Math.sin(angle) * radius;
      spd[i] = 0.3 + Math.random() * 0.7;
    }
    return { positions: pos, speeds: spd };
  }, []);

  useFrame((_, delta) => {
    timeRef.current += delta;

    for (const { ref, data } of [
      { ref: outerRef, data: outer },
      { ref: innerRef, data: inner },
    ]) {
      if (!ref.current) continue;
      const posAttr = ref.current.geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const count = arr.length / 3;
      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        const dx = arr[idx] - 3.5;
        const dz = arr[idx + 2] - 3.5;
        const angle = Math.atan2(dz, dx) + delta * data.speeds[i] * 0.04;
        const radius = Math.sqrt(dx * dx + dz * dz);
        arr[idx] = 3.5 + Math.cos(angle) * radius;
        arr[idx + 2] = 3.5 + Math.sin(angle) * radius;
        arr[idx + 1] += Math.sin(timeRef.current * data.speeds[i] + i) * delta * 0.025;
      }
      posAttr.needsUpdate = true;
    }
  });

  return (
    <>
      {/* Ground glow plane */}
      <GlowPlane />

      {/* Outer edge fade ring */}
      <EdgeGlow />

      {/* Outer particles — cool blue */}
      <points ref={outerRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={PARTICLE_COUNT_OUTER}
            array={outer.positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#3366cc"
          size={0.05}
          transparent
          opacity={0.55}
          sizeAttenuation
          depthWrite={false}
        />
      </points>

      {/* Inner particles — softer cyan, closer to board */}
      <points ref={innerRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={PARTICLE_COUNT_INNER}
            array={inner.positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#64d2ff"
          size={0.035}
          transparent
          opacity={0.35}
          sizeAttenuation
          depthWrite={false}
        />
      </points>

      {/* Ground grid — slightly more visible */}
      <gridHelper
        args={[22, 44, '#1a2a4a', '#111827']}
        position={[3.5, -0.1, 3.5]}
      />
    </>
  );
};
