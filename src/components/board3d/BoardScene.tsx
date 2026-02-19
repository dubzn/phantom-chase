import React, { useMemo } from 'react';
import { Tile3D } from './Tile3D';
import { CharacterModel } from './CharacterModel';
import { TileEffects } from './TileEffects';
import { QuestionMark3D } from './QuestionMark3D';
import { BushModel } from './BushModel';
import { BoardBackground } from './BoardBackground';
import { GRID_SIZE } from '../../services/GameService';

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
      {/* Lighting */}
      {/* Low ambient so shadows have contrast */}
      <ambientLight intensity={0.25} />

      {/* Main key light — warm, from front-right above */}
      <directionalLight
        position={[8, 14, 6]}
        intensity={1.2}
        color="#fff8ee"
      />

      {/* Rim / fill light — cool blue from back-left */}
      <directionalLight
        position={[-6, 7, -9]}
        intensity={0.45}
        color="#4488cc"
      />

      {/* Hemisphere — sky cool, ground dark */}
      <hemisphereLight
        color="#c8e8ff"
        groundColor="#050510"
        intensity={0.35}
      />

      {/* Board center underglow — subtle blue pooling on the surface */}
      <pointLight
        position={[3.5, 0.3, 3.5]}
        intensity={0.6}
        color="#0a2060"
        distance={7}
        decay={2}
      />

      {/* Corner accent lights for depth */}
      <pointLight position={[0, 1.5, 0]} intensity={0.25} color="#1a3a70" distance={5} decay={2} />
      <pointLight position={[7, 1.5, 7]} intensity={0.25} color="#1a3a70" distance={5} decay={2} />

      {/* Dynamic background */}
      <BoardBackground />

      {/* Board base platform */}
      <mesh position={[3.5, -0.05, 3.5]}>
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

      {/* Fog */}
      <fog attach="fog" args={['#000000', 14, 24]} />
    </>
  );
};
