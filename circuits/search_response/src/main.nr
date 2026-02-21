// ZK Hunt Lite - Search Response Circuit (Batched)
//
// Proves that the Prey is NOT at any of the searched tiles (up to 9),
// without revealing the actual position.
//
// Public inputs:
//   commitment   - Current position commitment
//   searched_x   - Array of 9 X coordinates being searched (unused slots = 255)
//   searched_y   - Array of 9 Y coordinates being searched (unused slots = 255)
//
// Private inputs:
//   my_x, my_y, my_nonce - Prey's actual position and blinding factor
//
// Constraints:
//   1. commitment == hash(my_x, my_y, my_nonce)
//   2. For each i in 0..9: (my_x, my_y) != (searched_x[i], searched_y[i])
//      Slots with 255 are out of valid range (0-7) so always pass.

fn hash3(a: Field, b: Field, c: Field) -> Field {
    let state: [Field; 4] = std::hash::poseidon2_permutation([a, b, c, 0], 4);
    state[0]
}

fn main(
    // Public inputs
    commitment: pub Field,
    searched_x: pub [u8; 9],
    searched_y: pub [u8; 9],
    // Private inputs
    my_x: u8,
    my_y: u8,
    my_nonce: Field,
) {
    // 1. Verify commitment matches actual position
    let computed = hash3(my_x as Field, my_y as Field, my_nonce);
    assert(commitment == computed, "commitment mismatch");

    // 2. Prove position differs from each searched tile
    for i in 0..9 {
        let same_x = (my_x == searched_x[i]) as u8;
        let same_y = (my_y == searched_y[i]) as u8;
        let both_same = same_x * same_y;
        assert(both_same == 0, "prey is at a searched position");
    }
}

#[test]
fn test_single_search_not_found() {
    // Prey at (2, 0), hunter searches (3, 0), rest padded with 255
    let nonce: Field = 12345;
    let commitment = hash3(2, 0, nonce);
    main(commitment, [3, 255, 255, 255, 255, 255, 255, 255, 255], [0, 255, 255, 255, 255, 255, 255, 255, 255], 2, 0, nonce);
}

#[test]
fn test_multiple_searches_not_found() {
    // Prey at (2, 3), hunter searches 3 tiles, rest padded
    let nonce: Field = 42;
    let commitment = hash3(2, 3, nonce);
    main(commitment, [1, 3, 2, 255, 255, 255, 255, 255, 255], [3, 3, 4, 255, 255, 255, 255, 255, 255], 2, 3, nonce);
}

#[test]
fn test_nine_searches_not_found() {
    // Prey at (4, 4), all 9 slots used (power search with diagonals)
    let nonce: Field = 99999;
    let commitment = hash3(4, 4, nonce);
    main(commitment, [3, 5, 3, 5, 3, 5, 4, 4, 4], [3, 3, 5, 5, 4, 4, 3, 5, 4], 4, 4, nonce);
}

#[test]
fn test_different_y_only() {
    // Prey at (3, 0), searches (3, 1) - same x, different y
    let nonce: Field = 12345;
    let commitment = hash3(3, 0, nonce);
    main(commitment, [3, 255, 255, 255, 255, 255, 255, 255, 255], [1, 255, 255, 255, 255, 255, 255, 255, 255], 3, 0, nonce);
}

#[test]
fn test_all_padded() {
    // All slots padded (edge case: no tiles to search)
    let nonce: Field = 12345;
    let commitment = hash3(2, 0, nonce);
    main(commitment, [255, 255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255, 255], 2, 0, nonce);
}

#[test(should_fail_with = "prey is at a searched position")]
fn test_caught_first_slot() {
    // Prey at (2, 0), searched at (2, 0) in first slot
    let nonce: Field = 12345;
    let commitment = hash3(2, 0, nonce);
    main(commitment, [2, 255, 255, 255, 255, 255, 255, 255, 255], [0, 255, 255, 255, 255, 255, 255, 255, 255], 2, 0, nonce);
}

#[test(should_fail_with = "prey is at a searched position")]
fn test_caught_third_slot() {
    // Prey at (4, 4), caught in the third search slot
    let nonce: Field = 99999;
    let commitment = hash3(4, 4, nonce);
    main(commitment, [3, 5, 4, 255, 255, 255, 255, 255, 255], [4, 4, 4, 255, 255, 255, 255, 255, 255], 4, 4, nonce);
}

#[test(should_fail_with = "prey is at a searched position")]
fn test_caught_ninth_slot() {
    // Prey at (1, 1), caught in the ninth (last) slot
    let nonce: Field = 77;
    let commitment = hash3(1, 1, nonce);
    main(commitment, [0, 2, 0, 3, 4, 5, 6, 7, 1], [0, 0, 1, 2, 3, 4, 5, 6, 1], 1, 1, nonce);
}

#[test(should_fail_with = "commitment mismatch")]
fn test_invalid_commitment() {
    let nonce: Field = 12345;
    let wrong_nonce: Field = 99999;
    let commitment = hash3(2, 0, nonce);
    main(commitment, [3, 255, 255, 255, 255, 255, 255, 255, 255], [0, 255, 255, 255, 255, 255, 255, 255, 255], 2, 0, wrong_nonce);
}
