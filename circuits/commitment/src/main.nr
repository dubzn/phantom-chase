// Tiny helper circuit to compute Poseidon2 commitment
// Used client-side (execute only, no proof) to compute hash3(x, y, nonce)

fn main(x: Field, y: Field, nonce: Field) -> pub Field {
    let state: [Field; 4] = std::hash::poseidon2_permutation([x, y, nonce, 0], 4);
    state[0]
}
