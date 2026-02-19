// ZK Hunt Lite - Private Move Circuit
//
// Proves that the Prey moved from one hidden position to an adjacent
// jungle tile without revealing either position.
//
// Public inputs:
//   old_commitment - Previous position commitment
//   new_commitment - New position commitment
//   map_id         - Index into the hardcoded MAPS array (0-19)
//
// Private inputs:
//   old_x, old_y, old_nonce - Previous position and blinding factor
//   new_x, new_y, new_nonce - New position and blinding factor
//
// Constraints:
//   1. old_commitment == hash(old_x, old_y, old_nonce)
//   2. new_commitment == hash(new_x, new_y, new_nonce)
//   3. Both positions are in bounds (0-7)
//   4. Manhattan distance between old and new <= 1 (adjacent or stay)
//   5. New tile is jungle (checked against MAPS[map_id])

fn hash3(a: Field, b: Field, c: Field) -> Field {
    let state: [Field; 4] = std::hash::poseidon2_permutation([a, b, c, 0], 4);
    state[0]
}

fn abs_diff(a: u8, b: u8) -> u8 {
    if a > b { a - b } else { b - a }
}

/// Pool of 20 balanced 8x8 maps. Index = y*8 + x. 1 = jungle, 0 = plains.
global MAPS: [[u8; 64]; 20] = [
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

fn main(
    // Public inputs
    old_commitment: pub Field,
    new_commitment: pub Field,
    map_id: pub u8,
    // Private inputs
    old_x: u8,
    old_y: u8,
    old_nonce: Field,
    new_x: u8,
    new_y: u8,
    new_nonce: Field,
) {
    // 1. Both positions must be in bounds
    assert(old_x < 8, "old_x out of bounds");
    assert(old_y < 8, "old_y out of bounds");
    assert(new_x < 8, "new_x out of bounds");
    assert(new_y < 8, "new_y out of bounds");

    // 2. Verify old commitment
    let computed_old = hash3(old_x as Field, old_y as Field, old_nonce);
    assert(old_commitment == computed_old, "old commitment mismatch");

    // 3. Verify new commitment
    let computed_new = hash3(new_x as Field, new_y as Field, new_nonce);
    assert(new_commitment == computed_new, "new commitment mismatch");

    // 4. Manhattan distance must be <= 1
    let dx = abs_diff(new_x, old_x);
    let dy = abs_diff(new_y, old_y);
    let distance = dx + dy;
    assert(distance <= 1, "move too far (Manhattan distance > 1)");

    // 5. map_id must be valid
    assert((map_id as u32) < 20, "invalid map_id");

    // 6. New tile must be jungle (checked against MAPS[map_id])
    let map = MAPS[map_id as u32];
    let new_idx: u32 = (new_y as u32) * 8 + (new_x as u32);
    assert(map[new_idx] == 1, "new tile is not jungle");
}

#[test]
fn test_valid_move() {
    // Move from (2, 0) to (3, 0) - both jungle on map 0
    let old_nonce: Field = 11111;
    let new_nonce: Field = 22222;
    let old_commitment = hash3(2, 0, old_nonce);
    let new_commitment = hash3(3, 0, new_nonce);
    main(old_commitment, new_commitment, 0, 2, 0, old_nonce, 3, 0, new_nonce);
}

#[test]
fn test_stay_in_place() {
    // Stay at (2, 0) on map 0
    let old_nonce: Field = 11111;
    let new_nonce: Field = 22222;
    let old_commitment = hash3(2, 0, old_nonce);
    let new_commitment = hash3(2, 0, new_nonce);
    main(old_commitment, new_commitment, 0, 2, 0, old_nonce, 2, 0, new_nonce);
}

#[test(should_fail_with = "move too far")]
fn test_move_too_far() {
    let old_nonce: Field = 11111;
    let new_nonce: Field = 22222;
    let old_commitment = hash3(2, 0, old_nonce);
    let new_commitment = hash3(4, 0, new_nonce);
    main(old_commitment, new_commitment, 0, 2, 0, old_nonce, 4, 0, new_nonce);
}

#[test(should_fail_with = "new tile is not jungle")]
fn test_move_to_plains() {
    // (1, 0) is plains on map 0
    let old_nonce: Field = 11111;
    let new_nonce: Field = 22222;
    let old_commitment = hash3(2, 0, old_nonce);
    let new_commitment = hash3(1, 0, new_nonce);
    main(old_commitment, new_commitment, 0, 2, 0, old_nonce, 1, 0, new_nonce);
}

#[test]
fn test_different_map() {
    // Map 1 (Central block): (2, 2) is jungle, (3, 2) is jungle
    let old_nonce: Field = 11111;
    let new_nonce: Field = 22222;
    let old_commitment = hash3(2, 2, old_nonce);
    let new_commitment = hash3(3, 2, new_nonce);
    main(old_commitment, new_commitment, 1, 2, 2, old_nonce, 3, 2, new_nonce);
}

#[test(should_fail_with = "invalid map_id")]
fn test_invalid_map_id() {
    let old_nonce: Field = 11111;
    let new_nonce: Field = 22222;
    let old_commitment = hash3(2, 0, old_nonce);
    let new_commitment = hash3(3, 0, new_nonce);
    main(old_commitment, new_commitment, 20, 2, 0, old_nonce, 3, 0, new_nonce);
}
