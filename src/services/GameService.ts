import { Noir } from '@noir-lang/noir_js';
import { NoirService } from './NoirService';

export const GRID_SIZE = 8;
export const MAX_TURNS = 10;
export const DASH_DISTANCE = 2;

export interface Position {
  x: number;
  y: number;
}

export interface PreySecret {
  x: number;
  y: number;
  nonce: bigint;
}

/**
 * Pool of 20 balanced 8x8 maps. Index = y*8 + x. 1 = jungle, 0 = plains.
 * Must match the MAPS constant in the contract and circuit.
 */
export const MAPS: number[][] = [
  // Map 0: Original
  [0,0,1,1,1,0,0,0,0,1,1,0,1,1,0,0,1,1,0,0,0,1,1,0,0,1,0,0,0,0,1,1,1,1,0,0,0,0,1,0,0,1,1,0,1,1,1,0,0,0,1,1,1,0,0,0,0,0,0,1,1,1,0,0],
  // Map 1: Central block
  [0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Map 2: Diagonal bands
  [1,1,0,0,0,0,1,1,1,1,1,0,0,1,1,1,0,1,1,1,1,1,1,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Map 3: Border jungle
  [1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1],
  // Map 4: Cross
  [0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0],
  // Map 5: L-shape
  [1,1,1,0,0,0,0,0,1,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0],
  // Map 6: Diamond
  [0,0,0,1,0,0,0,0,0,0,1,1,1,0,0,0,0,1,1,1,1,1,0,0,1,1,1,1,1,1,1,0,0,1,1,1,1,1,0,0,0,0,1,1,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
  // Map 7: River
  [0,0,0,0,0,0,0,0,1,1,0,0,0,0,1,1,1,1,1,0,0,1,1,1,0,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0,1,1,1,0,0,1,1,1,1,1,0,0,0,0,1,1,0,0,0,0,0,0,0,0],
  // Map 8: Horseshoe
  [0,1,1,1,1,1,1,0,0,1,1,0,0,1,1,0,0,1,0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,1,1,0,0,1,1,0,0,0,0,0,0,0,0,0],
  // Map 9: Maze corridors
  [0,1,0,1,0,1,0,0,0,1,0,1,0,1,0,0,0,1,1,1,0,1,1,0,0,0,0,1,0,0,1,0,1,1,0,1,1,0,1,0,0,1,0,0,1,0,1,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],
  // Map 10: Vertical ellipse
  [0,0,0,1,1,0,0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0],
  // Map 11: Triangle
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,1,1,1,1,0,0,0,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0],
  // Map 12: S-curve
  [0,0,1,1,1,1,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0],
  // Map 13: Connected strips
  [0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,1,1,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Map 14: Thick diagonal
  [1,1,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,1,1],
  // Map 15: C-shape
  [0,1,1,1,1,1,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0],
  // Map 16: Split bands
  [1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  // Map 17: Plus thick
  [0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,1,1,1,1,1,1,0,0,1,1,1,0,0,1,1,1,0,0,1,1,1,1,1,1,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Map 18: Inverted L
  [0,0,0,0,0,1,1,1,0,0,0,0,0,1,1,1,0,0,0,0,0,1,1,1,0,0,0,0,0,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Map 19: Spiral
  [0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,1,0,0,0,0,1,0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1,0,0,1,0,0,0,0,1,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],
];

export function isJungle(map: number[], x: number, y: number): boolean {
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return false;
  return map[y * GRID_SIZE + x] === 1;
}

export function isPlains(map: number[], x: number, y: number): boolean {
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return false;
  return map[y * GRID_SIZE + x] === 0;
}

export function isInBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
}

export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function isAdjacent(a: Position, b: Position): boolean {
  return manhattanDistance(a, b) <= 1;
}

/** Chebyshev distance ≤ 1 — allows diagonal tiles (hunter search/move range) */
export function canHunterSearch(a: Position, b: Position): boolean {
  return Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;
}

/** Manhattan distance ≤ 2 — prey dash range on plains */
export function canPreyDash(a: Position, b: Position): boolean {
  return manhattanDistance(a, b) <= DASH_DISTANCE;
}

export function getAdjacentTiles(pos: Position): Position[] {
  const offsets: [number, number][] = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];
  return offsets
    .map(([dx, dy]) => ({ x: pos.x + dx, y: pos.y + dy }))
    .filter((p) => isInBounds(p.x, p.y));
}

export function getAdjacentJungleTiles(map: number[], pos: Position): Position[] {
  return getAdjacentTiles(pos).filter((p) => isJungle(map, p.x, p.y));
}

export function generateRandomNonce(): bigint {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let result = BigInt(0);
  for (const b of bytes) {
    result = (result << BigInt(8)) | BigInt(b);
  }
  return result;
}

export class GameService {
  private noirService: NoirService;
  private commitmentCircuit: any = null;

  constructor() {
    this.noirService = new NoirService();
  }

  /**
   * Load the commitment circuit (cached after first load).
   */
  private async loadCommitmentCircuit() {
    if (this.commitmentCircuit) return this.commitmentCircuit;
    const response = await fetch('/circuits/commitment.json');
    if (!response.ok) throw new Error('Failed to load commitment circuit');
    this.commitmentCircuit = await response.json();
    return this.commitmentCircuit;
  }

  /**
   * Compute a Poseidon2 commitment for a position using the Noir circuit.
   * This executes the circuit (no proof generation) to get hash3(x, y, nonce).
   */
  async computeCommitment(x: number, y: number, nonce: bigint): Promise<string> {
    console.log(`[GameService] Computing commitment for (${x}, ${y}, ${nonce})...`);
    const circuit = await this.loadCommitmentCircuit();
    const noir = new Noir(circuit);
    const { returnValue } = await noir.execute({
      x: x.toString(),
      y: y.toString(),
      nonce: nonce.toString(),
    });
    console.log(`[GameService] Commitment computed: ${returnValue}`);
    return returnValue as string;
  }

  /**
   * Generate a jungle_move proof for entering or moving within jungle.
   * Commitments are computed automatically from positions and nonces.
   * mapId is the map index from the game state.
   */
  async generateJungleMoveProof(
    oldX: number,
    oldY: number,
    oldNonce: bigint,
    newX: number,
    newY: number,
    newNonce: bigint,
    mapId: number,
  ) {
    console.log('[GameService] Generating jungle_move proof...');

    // Compute the real Poseidon2 commitments
    const oldCommitment = await this.computeCommitment(oldX, oldY, oldNonce);
    const newCommitment = await this.computeCommitment(newX, newY, newNonce);

    const inputs = {
      old_commitment: oldCommitment,
      new_commitment: newCommitment,
      map_id: mapId,
      old_x: oldX,
      old_y: oldY,
      old_nonce: oldNonce.toString(),
      new_x: newX,
      new_y: newY,
      new_nonce: newNonce.toString(),
    };

    const result = await this.noirService.generateProof('jungle_move', inputs);
    console.log('[GameService] jungle_move proof generated');
    return result;
  }

  /**
   * Generate a batched search_response proof proving prey is NOT at any of the searched tiles.
   * Accepts arrays of searched coordinates (up to 9) and pads with 255 if fewer.
   * Commitment is computed automatically from position and nonce.
   */
  async generateSearchResponseProof(
    myX: number,
    myY: number,
    myNonce: bigint,
    searchedXArray: number[],
    searchedYArray: number[],
  ) {
    console.log(`[GameService] Generating batched search_response proof for ${searchedXArray.length} tiles...`);

    // Pad arrays to length 9 with 255 (out of valid 0-7 range, always passes)
    const paddedX = [...searchedXArray];
    const paddedY = [...searchedYArray];
    while (paddedX.length < 9) paddedX.push(255);
    while (paddedY.length < 9) paddedY.push(255);

    // Compute the real Poseidon2 commitment
    const commitment = await this.computeCommitment(myX, myY, myNonce);

    const inputs = {
      commitment,
      searched_x: paddedX,
      searched_y: paddedY,
      my_x: myX,
      my_y: myY,
      my_nonce: myNonce.toString(),
    };

    const result = await this.noirService.generateProof('search_response', inputs);
    console.log('[GameService] search_response proof generated');
    return result;
  }
}
