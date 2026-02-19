import { describe, it, expect } from 'vitest';
import {
  MAPS,
  GRID_SIZE,
  isJungle,
  isPlains,
  isInBounds,
  manhattanDistance,
  isAdjacent,
  getAdjacentTiles,
  getAdjacentJungleTiles,
  generateRandomNonce,
} from './GameService';

const MAP0 = MAPS[0];

describe('GameService utilities', () => {
  describe('MAPS', () => {
    it('has 20 maps', () => {
      expect(MAPS).toHaveLength(20);
    });

    it('each map has 64 tiles (8x8)', () => {
      for (const map of MAPS) {
        expect(map).toHaveLength(64);
      }
    });

    it('only contains 0s and 1s', () => {
      for (const map of MAPS) {
        for (const tile of map) {
          expect(tile === 0 || tile === 1).toBe(true);
        }
      }
    });

    it('GRID_SIZE is 8', () => {
      expect(GRID_SIZE).toBe(8);
    });
  });

  describe('isJungle / isPlains', () => {
    it('(0,0) is plains on map 0', () => {
      expect(isJungle(MAP0, 0, 0)).toBe(false);
      expect(isPlains(MAP0, 0, 0)).toBe(true);
    });

    it('(2,0) is jungle on map 0', () => {
      expect(isJungle(MAP0, 2, 0)).toBe(true);
      expect(isPlains(MAP0, 2, 0)).toBe(false);
    });

    it('out of bounds returns false', () => {
      expect(isJungle(MAP0, -1, 0)).toBe(false);
      expect(isJungle(MAP0, 8, 0)).toBe(false);
      expect(isPlains(MAP0, -1, 0)).toBe(false);
    });
  });

  describe('isInBounds', () => {
    it('valid positions', () => {
      expect(isInBounds(0, 0)).toBe(true);
      expect(isInBounds(7, 7)).toBe(true);
    });

    it('invalid positions', () => {
      expect(isInBounds(-1, 0)).toBe(false);
      expect(isInBounds(8, 0)).toBe(false);
      expect(isInBounds(0, 8)).toBe(false);
    });
  });

  describe('manhattanDistance', () => {
    it('same position is 0', () => {
      expect(manhattanDistance({ x: 3, y: 3 }, { x: 3, y: 3 })).toBe(0);
    });

    it('adjacent is 1', () => {
      expect(manhattanDistance({ x: 3, y: 3 }, { x: 4, y: 3 })).toBe(1);
    });

    it('diagonal is 2', () => {
      expect(manhattanDistance({ x: 3, y: 3 }, { x: 4, y: 4 })).toBe(2);
    });
  });

  describe('isAdjacent', () => {
    it('same tile is adjacent (stay)', () => {
      expect(isAdjacent({ x: 3, y: 3 }, { x: 3, y: 3 })).toBe(true);
    });

    it('orthogonal neighbor is adjacent', () => {
      expect(isAdjacent({ x: 3, y: 3 }, { x: 4, y: 3 })).toBe(true);
    });

    it('diagonal is NOT adjacent', () => {
      expect(isAdjacent({ x: 3, y: 3 }, { x: 4, y: 4 })).toBe(false);
    });
  });

  describe('getAdjacentTiles', () => {
    it('center tile has 5 adjacent (including self)', () => {
      const tiles = getAdjacentTiles({ x: 3, y: 3 });
      expect(tiles).toHaveLength(5);
    });

    it('corner tile has 3 adjacent', () => {
      const tiles = getAdjacentTiles({ x: 0, y: 0 });
      expect(tiles).toHaveLength(3);
    });

    it('edge tile has 4 adjacent', () => {
      const tiles = getAdjacentTiles({ x: 0, y: 3 });
      expect(tiles).toHaveLength(4);
    });
  });

  describe('getAdjacentJungleTiles', () => {
    it('returns only jungle tiles from adjacent', () => {
      const tiles = getAdjacentJungleTiles(MAP0, { x: 1, y: 1 });
      for (const t of tiles) {
        expect(isJungle(MAP0, t.x, t.y)).toBe(true);
      }
    });
  });

  describe('generateRandomNonce', () => {
    it('returns a bigint', () => {
      const nonce = generateRandomNonce();
      expect(typeof nonce).toBe('bigint');
    });

    it('generates unique values', () => {
      const a = generateRandomNonce();
      const b = generateRandomNonce();
      expect(a).not.toBe(b);
    });
  });
});
