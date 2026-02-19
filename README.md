# Phantom Chase

> A zero-knowledge hunter vs. prey game on the Stellar blockchain — built for a hackathon.

---

## What is Phantom Chase?

Phantom Chase is a 1v1 asymmetric strategy game where one player hunts and the other hides. The twist: the prey can become **cryptographically invisible** using zero-knowledge proofs. When the prey enters a jungle tile, their real position is replaced by a Poseidon2 hash commitment — the hunter sees only a ghost, the blockchain knows nothing more.

Every move, every search, every evasion is settled on-chain via Soroban smart contracts on the Stellar network. No server, no trust — just math.

---

## How it Works

### Roles

| Role | Objective |
|------|-----------|
| **Hunter** | Move across the board and search tiles to catch the prey |
| **Prey** | Evade the hunter and survive until the round ends |

Roles swap after each round. The player with the most points across all rounds wins.

### Board

An 8x8 grid with two terrain types:

- **Plains** — fully visible. Position is public on-chain.
- **Jungle** — dense cover. Prey can hide here using ZK proofs.

There are 20 different maps (central block, diagonal bands, spirals, etc.), randomly assigned per match.

### Turn Structure

Each round alternates turns between hunter and prey (up to 10 turns). On each turn:

- **Hunter**: move one tile (orthogonally) or search jungle tiles
- **Prey**: move one tile — publicly on plains, privately in jungle

### Winning a Round

- **Hunter scores** if they successfully search the tile where the prey is hiding
- **Prey scores** if they survive all turns without being caught

---

## Features

### Zero-Knowledge Position Privacy

When the prey enters jungle, their position is hidden behind a cryptographic commitment (`Poseidon2(x, y, nonce)`). The nonce is kept client-side only. The contract and the hunter never see the real coordinates.

### ZK-Verified Moves

Every hidden move (jungle-to-jungle) is backed by an **UltraHonk proof** generated in the browser (~30–60s). The proof verifies:

- The old commitment matches the previous position
- The new commitment matches the new position
- The move is valid (Manhattan distance ≤ 1)
- The destination tile is actually jungle

### ZK-Verified Search Response

When the hunter searches tiles, the prey must prove they are **not** at any of the searched positions — without revealing where they actually are. The circuit supports batches of up to 5 searched tiles simultaneously.

### Power Search

The hunter has 3 Power Search charges per match. Using one searches all adjacent jungle tiles at once — each triggering a separate ZK proof response from the prey.

### 20 Unique Maps

A pool of 20 hand-crafted 8x8 maps with varied jungle layouts: central blocks, spirals, mazes, rivers, borders, diagonals, and more. Each game uses a different map.

### 3D Board Rendering

The board is rendered in 3D using React Three Fiber. Jungle tiles and plains have distinct visual styles, with animated effects for searched tiles and valid move highlighting.

### On-Chain Game State

All game state (phase, scores, positions, turns, commitments) lives in a Soroban smart contract. The frontend polls every 3 seconds with no backend required.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| ZK Circuits | Noir (v1.0.0-beta.9) |
| ZK Prover | Barretenberg / UltraHonk (v0.87.0) |
| On-chain Verifier | `ultrahonk-soroban-contract` (pre-compiled WASM) |
| Smart Contracts | Rust / Soroban SDK 23.1.0 |
| Blockchain | Stellar (local or testnet) |
| Frontend | React + TypeScript + Vite |
| 3D Rendering | React Three Fiber |
| Wallet | Freighter via `@creit.tech/stellar-wallets-kit` |

---

## ZK Circuits

### `jungle_move`

Proves the prey moved from one hidden jungle position to an adjacent jungle tile.

**Public inputs:** `old_commitment`, `new_commitment`, `map_id`
**Private inputs:** `old_x`, `old_y`, `old_nonce`, `new_x`, `new_y`, `new_nonce`

### `search_response`

Proves the prey is not at any of the searched tiles (batch of up to 5).

**Public inputs:** `commitment`, `searched_x[5]`, `searched_y[5]`
**Private inputs:** `my_x`, `my_y`, `my_nonce`

### `commitment`

Client-side only. Computes `Poseidon2(x, y, nonce)` when the prey first enters jungle.

---

## Architecture

```
ultrahonk-soroban-contract   (ZK verifier, pre-compiled WASM)
        ^
        |  cross-contract call
        |
  zk-hunt contract           (game state machine)
        ^
        |  Soroban transactions
        |
  React frontend              (proof generation + wallet + UI)
        |
   @aztec/bb.js               (UltraHonk prover in-browser)
```

### Proof Flow

1. Player triggers an action (enter jungle, move in jungle, respond to search)
2. Frontend calls `NoirService.generateProof()` — loads circuit WASM, generates witness, runs UltraHonk prover
3. Proof blob is assembled: `u32_be(num_fields) || public_inputs || proof_bytes`
4. Transaction is sent to Soroban; contract forwards blob to the verifier via cross-contract call
5. Verifier validates on-chain; game state advances if valid

---

## Local Deployment

### Prerequisites

- [Rust](https://rustup.rs/) with `wasm32v1-none` target:
  ```bash
  rustup target add wasm32v1-none
  ```
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli)
- [Bun](https://bun.sh/)
- Docker (for the local Stellar container)

### Deploy

```bash
# 1. Start the local Stellar network (wait ~30s)
stellar container start local --limits unlimited

# 2. Install JS dependencies
bun install

# 3. Run the full deploy pipeline
./deploy.sh

# 4. Start the dev server
bun run dev
```

`deploy.sh` handles: funding accounts, deploying the UltraHonk verifier, deploying the game contract, and writing contract IDs to `.env`.

### Configure Freighter Wallet

Add a custom network in Freighter with these settings:

| Field | Value |
|-------|-------|
| Name | `LOCAL` |
| Horizon RPC URL | `http://localhost:8000` |
| Soroban RPC URL | `http://localhost:8000/rpc` |
| Network Passphrase | `Standalone Network ; February 2017` |
| Friendbot URL | `http://localhost:8000/friendbot` |

Enable **"Allow connecting to non-HTTPS networks"** in Freighter settings.

### Individual Build Commands

```bash
make build-zk-hunt           # Build the game contract (WASM)
make deploy-ultrahonk        # Deploy the ZK verifier
make deploy-zk-hunt          # Deploy the game contract
make update-env              # Write contract IDs to .env
make clean                   # Remove build artifacts and deploy state
```

### Recompile Circuits (optional)

```bash
cd circuits/jungle_move && nargo compile
bb write_vk --oracle_hash keccak -b target/jungle_move.json -o target/vk

cd circuits/search_response && nargo compile
bb write_vk --oracle_hash keccak -b target/search_response.json -o target/vk
```

Copy output files to `public/circuits/` for the frontend to load.

---

## How to Play

1. Connect your Freighter wallet
2. Player 1 clicks **Create Game** — shares the session ID with the opponent
3. Player 2 enters the session ID and clicks **Join**
4. The game begins: Hunter moves first
5. Prey enters jungle to go hidden — a ZK proof is generated automatically
6. Hunter searches tiles to find the prey; prey responds with a ZK proof they weren't there
7. Rounds continue with swapped roles; highest score wins
