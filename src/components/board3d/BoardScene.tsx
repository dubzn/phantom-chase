import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Tile3D } from './Tile3D';
import { CharacterModel } from './CharacterModel';
import { TileEffects } from './TileEffects';
import { QuestionMark3D } from './QuestionMark3D';
import { BushModel } from './BushModel';
import { SceneryTrees } from './SceneryTrees';
import { SceneryGrass } from './SceneryGrass';
import { GRID_SIZE } from '../../services/GameService';

const GrassGround: React.FC = () => {
  const { scene } = useGLTF('/3d/surface.glb');

  // Extract the color map from the first mesh in the surface pack (grass type)
  const texture = useMemo(() => {
    let tex: THREE.Texture | null = null;
    scene.traverse((child) => {
      if (tex) return;
      if ((child as THREE.Mesh).isMesh) {
        const mat = ((child as THREE.Mesh).material) as THREE.MeshStandardMaterial;
        const source = Array.isArray(mat) ? mat[0] : mat;
        if ((source as THREE.MeshStandardMaterial).map) {
          tex = (source as THREE.MeshStandardMaterial).map!.clone();
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(10, 10);
          tex.needsUpdate = true;
        }
      }
    });
    return tex;
  }, [scene]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.5, -0.11, 3.5]} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial map={texture ?? undefined} color={texture ? '#ffffff' : '#4a7c3f'} roughness={0.9} metalness={0} />
    </mesh>
  );
};
useGLTF.preload('/3d/surface.glb');

interface BoardSceneProps {
  map: number[];
  hunterPos: { x: number; y: number } | null;
  preyPos: { x: number; y: number } | null;
  preyVisible: boolean;
  preyGhostPos: { x: number; y: number } | null;
  lastKnownPreyPos: { x: number; y: number } | null;
  searchedTiles: Array<{ x: number; y: number }>;
  validMoves: Set<string>;
  selectedTile: { x: number; y: number } | null;
  onTileClick: (x: number, y: number, screenX: number, screenY: number) => void;
  onTileRightClick: (x: number, y: number) => void;
}

// Deterministic pseudo-random from tile index for bush variation
function seededRandom(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Golden hour sun — mid-height, warm golden, subtle flicker
const SunLight: React.FC = () => {
  const ref = useRef<THREE.DirectionalLight>(null);
  const t = useRef(0);

  useFrame((_, d) => {
    if (!ref.current) return;
    t.current += d;
    ref.current.intensity = 1.3 + Math.sin(t.current * 0.2) * 0.1;
  });

  return (
    <directionalLight
      ref={ref}
      position={[10, 5, -8]}
      intensity={1.3}
      color="#ffd090"
      castShadow
      shadow-mapSize-width={1024}
      shadow-mapSize-height={1024}
      shadow-camera-near={0.5}
      shadow-camera-far={50}
      shadow-camera-left={-15}
      shadow-camera-right={15}
      shadow-camera-top={15}
      shadow-camera-bottom={-15}
      shadow-bias={-0.001}
    />
  );
};

export const BoardScene: React.FC<BoardSceneProps> = ({
  map,
  hunterPos,
  preyPos,
  preyVisible,
  preyGhostPos,
  lastKnownPreyPos,
  searchedTiles,
  validMoves,
  selectedTile,
  onTileClick,
  onTileRightClick,
}) => {
  const tiles: React.ReactNode[] = [];

  // Every jungle tile gets a bush with a random variant (1, 2, or 3)
  // bush_3 is heavy (175K verts), so only ~15% of tiles use it
  const bushes = useMemo(() => {
    const result: Array<{
      tileX: number; tileY: number;
      x: number; y: number; z: number;
      scale: number; rotation: number; variant: 1 | 2 | 3;
    }> = [];
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      if (map[i] !== 1) continue;
      const tx = i % GRID_SIZE;
      const ty = Math.floor(i / GRID_SIZE);
      const r = seededRandom(i);
      const r2 = seededRandom(i + 100);
      const r3 = seededRandom(i + 200);

      // Only bush_2 and bush_3 (bush_1 contrasts too much)
      let variant: 1 | 2 | 3;
      if (r < 0.8) variant = 2;
      else variant = 3;

      result.push({
        tileX: tx,
        tileY: ty,
        x: tx + (r2 - 0.5) * 0.2,
        y: 0.07,
        z: ty + (r3 - 0.5) * 0.2,
        scale: 0.5 + r2 * 0.3,
        rotation: r * Math.PI * 2,
        variant,
      });
    }
    return result;
  }, [map]);

  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const x = i % GRID_SIZE;
    const y = Math.floor(i / GRID_SIZE);
    const isJungle = map[i] === 1;
    const isSearched = searchedTiles.some((t) => t.x === x && t.y === y);
    const isValidMove = validMoves.has(`${x},${y}`);
    const isSelected = selectedTile?.x === x && selectedTile?.y === y;

    tiles.push(
      <Tile3D
        key={i}
        x={x}
        y={y}
        isJungle={isJungle}
        isSearched={isSearched}
        isValidMove={isValidMove}
        isSelected={isSelected}
        onClick={onTileClick}
        onRightClick={onTileRightClick}
      />,
    );
  }

  return (
    <>
      {/* Golden hour sky — sun mid-height, moderate scattering */}
      <Sky
        distance={450}
        sunPosition={[4, 1.5, -4]}
        inclination={0.48}
        azimuth={0.28}
        rayleigh={2.5}
        turbidity={10}
        mieCoefficient={0.004}
        mieDirectionalG={0.8}
      />

      {/* Lighting */}
      {/* Warm ambient — golden hour bounce */}
      <ambientLight intensity={0.45} color="#ffe0b0" />

      {/* Main key light — golden hour sun */}
      <SunLight />

      {/* Fill light — soft blue from opposite sky */}
      <directionalLight
        position={[-5, 4, 6]}
        intensity={0.2}
        color="#8090cc"
      />

      {/* Hemisphere — golden sky, warm brown ground */}
      <hemisphereLight
        color="#ffcc88"
        groundColor="#6b5040"
        intensity={0.45}
      />

      {/* Corner accent lights — golden */}
      <pointLight position={[0, 1.5, 0]} intensity={0.2} color="#ffaa50" distance={5} decay={2} />
      <pointLight position={[7, 1.5, 7]} intensity={0.2} color="#ffaa50" distance={5} decay={2} />

      {/* Ground plane */}
      <GrassGround />

      {/* Grass/flower decorations near the board */}
      <SceneryGrass />

      {/* Scenery trees around the board */}
      <SceneryTrees />

      {/* Board base platform */}
      <mesh position={[3.5, -0.05, 3.5]} receiveShadow>
        <boxGeometry args={[8.5, 0.08, 8.5]} />
        <meshStandardMaterial color="#0a0d18" roughness={0.6} metalness={0.3} />
      </mesh>

      {/* Tiles */}
      {tiles}

      {/* Bushes on jungle tiles */}
      {bushes.map((b, i) => {
        const preyOnTile =
          (preyPos && preyVisible && preyPos.x === b.tileX && preyPos.y === b.tileY) ||
          (preyGhostPos && preyGhostPos.x === b.tileX && preyGhostPos.y === b.tileY);
        return (
          <BushModel
            key={`bush-${i}`}
            position={[b.x, b.y, b.z]}
            scale={b.scale}
            rotation={b.rotation}
            variant={b.variant}
            occupied={!!preyOnTile}
          />
        );
      })}

      {/* Effects */}
      <TileEffects searchedTiles={searchedTiles} />

      {/* Hunter */}
      {hunterPos && (
        <CharacterModel
          position={[hunterPos.x, hunterPos.y]}
          type="hunter"
          visible
        />
      )}

      {/* Prey (publicly visible) */}
      {preyPos && preyVisible && (
        <CharacterModel
          position={[preyPos.x, preyPos.y]}
          type="prey"
          visible
        />
      )}

      {/* Prey ghost (only the prey player sees this when hidden) */}
      {preyGhostPos && (
        <CharacterModel
          position={[preyGhostPos.x, preyGhostPos.y]}
          type="prey"
          visible
          ghost
        />
      )}

      {/* Question mark at last known prey position (hunter view only) */}
      {lastKnownPreyPos && (
        <QuestionMark3D
          position={[lastKnownPreyPos.x, lastKnownPreyPos.y]}
        />
      )}

      {/* Atmospheric fog — golden hour haze */}
      <fog attach="fog" args={['#ffd8a0', 22, 70]} />
    </>
  );
};
