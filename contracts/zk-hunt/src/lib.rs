#![no_std]

//! # ZK Hunt Lite v2
//!
//! A PvP fog-of-war game on Soroban where a Hunter chases a Prey
//! hidden in jungle tiles. The Prey's position is committed via
//! ZK proofs (Noir circuits verified by UltraHonk on-chain).
//!
//! - Hunter: public position, moves openly, can search jungle tiles
//! - Prey: starts public, can enter/exit jungle freely
//! - Round win: Hunter catches Prey OR Prey survives 10 turns
//! - Match: 4 rounds (2 as hunter each), player with most points wins
//! - Power Search: Hunter can search ALL adjacent jungle tiles (2 uses per round)

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, vec, Address, Bytes, BytesN, Env,
    IntoVal, Symbol, Val, Vec,
};

// ============================================================================
// External Contract Interface (UltraHonk verifier)
// ============================================================================

mod ultrahonk_contract {
    soroban_sdk::contractimport!(file = "ultrahonk_soroban_contract.wasm");
}

pub const ULTRAHONK_CONTRACT_ADDRESS: &str = "CB4QQWCTM4GHUQXADL72GCAIY4XOAD7CVFLVU7ZSOJ4SI3MDXSTYYYUN";

// ============================================================================
// Constants
// ============================================================================

/// TTL for game storage (30 days in ledgers, ~5 seconds per ledger)
const GAME_TTL_LEDGERS: u32 = 518_400;

/// Max turns before Prey wins by survival
const MAX_TURNS: u32 = 10;

/// Initial power searches for hunter
const POWER_SEARCHES_INITIAL: u32 = 2;

/// Number of rounds each player is hunter
const ROUNDS_PER_SIDE: u32 = 1; //TODO: change

/// Total rounds in a match (each side hunts ROUNDS_PER_SIDE times)
const TOTAL_ROUNDS: u32 = ROUNDS_PER_SIDE * 2;

/// Minimum Manhattan distance between hunter and prey spawn positions.
const MIN_SPAWN_DISTANCE: u32 = 3;

/// Number of available maps.
pub(crate) const MAP_COUNT: u32 = 20;

/// Pool of 20 balanced 8x8 maps as flat [u8; 64] arrays.
/// Index = y*8 + x. 1 = jungle, 0 = plains.
pub(crate) const MAPS: [[u8; 64]; 20] = [
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

// ============================================================================
// Errors
// ============================================================================

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    GameNotFound = 1,
    NotPlayer = 2,
    WrongPhase = 3,
    NotHunter = 4,
    NotPrey = 5,
    OutOfBounds = 6,
    InvalidMove = 7,
    NotJungle = 8,
    ProofFailed = 9,
    GameAlreadyEnded = 10,
    NotAdjacentJungle = 11,
    SearchPending = 12,
    NoPowerSearches = 13,
    PreyNotHidden = 14,
    PreyAlreadyHidden = 15,
    IsJungle = 16,
    NoEMP = 17,
    EmpTargetHidden = 18,
    EmpOutOfRange = 19,
    NoDashes = 20,
    PreyFrozen = 21,
}

// ============================================================================
// Data Types
// ============================================================================

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum GamePhase {
    WaitingForPlayer2 = 0,
    HunterTurn = 1,
    PreyTurn = 2,
    SearchPending = 3,
    Ended = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Game {
    pub hunter: Address,
    pub prey: Address,
    pub hunter_x: u32,
    pub hunter_y: u32,
    pub prey_x: u32,
    pub prey_y: u32,
    pub prey_is_hidden: bool,
    pub prey_commitment: BytesN<32>,
    pub phase: GamePhase,
    pub turn_number: u32,
    pub power_searches_remaining: u32,
    pub searched_tiles_x: Vec<u32>,
    pub searched_tiles_y: Vec<u32>,
    pub winner: Option<Address>,
    pub player1: Address,
    pub player2: Address,
    pub round: u32,
    pub total_rounds: u32,
    pub player1_score: u32,
    pub player2_score: u32,
    pub map_index: u32,
    pub emp_uses_remaining: u32,
    pub prey_is_frozen: bool,
    pub prey_dash_remaining: u32,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Game(u32),
    Admin,
    MoveVk,
    SearchVk,
    NextSessionId,
    GameHubAddress,
}

// ============================================================================
// Contract
// ============================================================================

#[contract]
pub struct ZkHuntContract;

#[contractimpl]
impl ZkHuntContract {
    /// Initialize the contract with an admin.
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::NextSessionId, &1u32);
    }

    /// Set verification keys (called post-deploy by admin).
    pub fn set_vks(env: Env, move_vk: Bytes, search_vk: Bytes) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();

        env.storage().instance().set(&DataKey::MoveVk, &move_vk);
        env.storage()
            .instance()
            .set(&DataKey::SearchVk, &search_vk);
    }

    /// Set the Game Hub contract address (called post-deploy by admin).
    /// If not set, GameHub notifications are silently skipped (local dev).
    pub fn set_game_hub(env: Env, game_hub: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::GameHubAddress, &game_hub);
    }

    /// Create a new game. Caller becomes the Hunter.
    pub fn create_game(env: Env, hunter: Address) -> u32 {
        hunter.require_auth();

        let session_id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextSessionId)
            .unwrap_or(1);
        env.storage()
            .instance()
            .set(&DataKey::NextSessionId, &(session_id + 1));

        let map_index = select_random_map(&env);
        let (hx, hy, px, py) = random_starting_positions(&env, map_index);

        let game = Game {
            hunter: hunter.clone(),
            prey: hunter.clone(), // placeholder until prey joins
            hunter_x: hx,
            hunter_y: hy,
            prey_x: px,
            prey_y: py,
            prey_is_hidden: false,
            prey_commitment: BytesN::from_array(&env, &[0u8; 32]),
            phase: GamePhase::WaitingForPlayer2,
            turn_number: 0,
            power_searches_remaining: POWER_SEARCHES_INITIAL,
            searched_tiles_x: vec![&env],
            searched_tiles_y: vec![&env],
            winner: None,
            player1: hunter.clone(),
            player2: hunter.clone(), // placeholder until prey joins
            round: 1,
            total_rounds: TOTAL_ROUNDS,
            player1_score: 0,
            player2_score: 0,
            map_index,
            emp_uses_remaining: 1,
            prey_is_frozen: false,
            prey_dash_remaining: 2,
        };

        let key = DataKey::Game(session_id);
        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        session_id
    }

    /// Prey joins an existing game.
    pub fn join_game(env: Env, session_id: u32, prey: Address) -> Result<(), Error> {
        prey.require_auth();

        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::WaitingForPlayer2 {
            return Err(Error::WrongPhase);
        }

        game.prey = prey.clone();
        game.player2 = prey;
        game.phase = GamePhase::HunterTurn;
        game.turn_number = 1;

        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        // Notify Game Hub that a game session started
        notify_game_hub_start(
            &env,
            session_id,
            game.player1.clone(),
            game.player2.clone(),
        );

        Ok(())
    }

    /// Hunter moves to an adjacent tile (public movement).
    pub fn hunter_move(
        env: Env,
        session_id: u32,
        x: u32,
        y: u32,
    ) -> Result<(), Error> {
        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::HunterTurn {
            return Err(Error::WrongPhase);
        }

        game.hunter.require_auth();

        if x >= 8 || y >= 8 {
            return Err(Error::OutOfBounds);
        }

        let dx = abs_diff(x, game.hunter_x);
        let dy = abs_diff(y, game.hunter_y);
        if dx + dy > 1 {
            return Err(Error::InvalidMove);
        }

        game.hunter_x = x;
        game.hunter_y = y;

        // Check if hunter stepped on visible prey
        if !game.prey_is_hidden && game.hunter_x == game.prey_x && game.hunter_y == game.prey_y {
            end_round(&env, &key, &mut game, true);
            return Ok(());
        }

        game.phase = GamePhase::PreyTurn;

        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        Ok(())
    }

    /// Hunter searches one adjacent jungle tile for the Prey.
    pub fn hunter_search(
        env: Env,
        session_id: u32,
        x: u32,
        y: u32,
    ) -> Result<(), Error> {
        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::HunterTurn {
            return Err(Error::WrongPhase);
        }

        game.hunter.require_auth();

        if !game.prey_is_hidden {
            return Err(Error::PreyNotHidden);
        }

        if x >= 8 || y >= 8 {
            return Err(Error::OutOfBounds);
        }

        let dx = abs_diff(x, game.hunter_x);
        let dy = abs_diff(y, game.hunter_y);
        if dx > 1 || dy > 1 {
            return Err(Error::InvalidMove);
        }

        let idx = (y * 8 + x) as usize;
        if MAPS[game.map_index as usize][idx] == 0 {
            return Err(Error::NotJungle);
        }

        game.searched_tiles_x = vec![&env, x];
        game.searched_tiles_y = vec![&env, y];
        game.phase = GamePhase::SearchPending;

        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        Ok(())
    }

    /// Hunter uses power search to search ALL adjacent jungle tiles (limited uses).
    pub fn hunter_power_search(env: Env, session_id: u32) -> Result<(), Error> {
        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::HunterTurn {
            return Err(Error::WrongPhase);
        }

        game.hunter.require_auth();

        if !game.prey_is_hidden {
            return Err(Error::PreyNotHidden);
        }

        if game.power_searches_remaining == 0 {
            return Err(Error::NoPowerSearches);
        }

        game.power_searches_remaining -= 1;

        // Find all adjacent jungle tiles
        let mut tiles_x: Vec<u32> = vec![&env];
        let mut tiles_y: Vec<u32> = vec![&env];

        let hx = game.hunter_x;
        let hy = game.hunter_y;

        // Check center + 4 cardinals + 4 diagonals (9 slots, matches ZK search_response circuit)
        let offsets: [(i32, i32); 9] = [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)];
        for (ox, oy) in offsets.iter() {
            let nx = hx as i32 + ox;
            let ny = hy as i32 + oy;
            if nx >= 0 && nx < 8 && ny >= 0 && ny < 8 {
                let tile_idx = (ny * 8 + nx) as usize;
                if MAPS[game.map_index as usize][tile_idx] == 1 {
                    tiles_x.push_back(nx as u32);
                    tiles_y.push_back(ny as u32);
                }
            }
        }

        game.searched_tiles_x = tiles_x;
        game.searched_tiles_y = tiles_y;
        game.phase = GamePhase::SearchPending;

        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        Ok(())
    }

    /// Prey moves publicly on plains (visible to visible).
    pub fn prey_move_public(
        env: Env,
        session_id: u32,
        x: u32,
        y: u32,
    ) -> Result<(), Error> {
        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::PreyTurn {
            return Err(Error::WrongPhase);
        }

        game.prey.require_auth();

        if game.prey_is_frozen {
            return Err(Error::PreyFrozen);
        }

        if x >= 8 || y >= 8 {
            return Err(Error::OutOfBounds);
        }

        // Must move to plains
        let idx = (y * 8 + x) as usize;
        if MAPS[game.map_index as usize][idx] == 1 {
            return Err(Error::IsJungle);
        }

        // Validate adjacency from last known position
        let dx = abs_diff(x, game.prey_x);
        let dy = abs_diff(y, game.prey_y);
        if dx + dy > 1 {
            return Err(Error::InvalidMove);
        }

        game.prey_x = x;
        game.prey_y = y;
        game.prey_is_hidden = false;

        check_prey_survival(&env, &key, &mut game);

        Ok(())
    }

    /// Prey enters jungle from a visible position (becomes hidden).
    pub fn prey_enter_jungle(
        env: Env,
        session_id: u32,
        new_commitment: BytesN<32>,
        proof: Bytes,
    ) -> Result<(), Error> {
        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::PreyTurn {
            return Err(Error::WrongPhase);
        }

        game.prey.require_auth();

        if game.prey_is_frozen {
            return Err(Error::PreyFrozen);
        }

        if game.prey_is_hidden {
            return Err(Error::PreyAlreadyHidden);
        }

        // Validate public inputs: new_commitment in proof must match the argument
        let proof_new_commitment = extract_bytes32(&proof, 36);
        assert!(
            proof_new_commitment == new_commitment,
            "proof new_commitment does not match argument"
        );

        // Validate map_id in proof matches game state
        let proof_map_id = extract_u8(&proof, 68);
        assert!(
            proof_map_id == game.map_index as u8,
            "proof map_id does not match game state"
        );

        // Verify the jungle_move proof
        Self::verify_proof(&env, &DataKey::MoveVk, &proof)?;

        game.prey_commitment = new_commitment;
        game.prey_is_hidden = true;
        // Clear last known public position (prey now hidden)
        // Keep prey_x/prey_y as last-known for UI reference

        check_prey_survival(&env, &key, &mut game);

        Ok(())
    }

    /// Prey moves within jungle (hidden to hidden).
    pub fn prey_move_jungle(
        env: Env,
        session_id: u32,
        new_commitment: BytesN<32>,
        proof: Bytes,
    ) -> Result<(), Error> {
        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::PreyTurn {
            return Err(Error::WrongPhase);
        }

        game.prey.require_auth();

        if game.prey_is_frozen {
            return Err(Error::PreyFrozen);
        }

        if !game.prey_is_hidden {
            return Err(Error::PreyNotHidden);
        }

        // Validate public inputs: old_commitment must match stored, new_commitment must match argument
        let proof_old_commitment = extract_bytes32(&proof, 4);
        assert!(
            proof_old_commitment == game.prey_commitment,
            "proof old_commitment does not match game state"
        );
        let proof_new_commitment = extract_bytes32(&proof, 36);
        assert!(
            proof_new_commitment == new_commitment,
            "proof new_commitment does not match argument"
        );

        // Validate map_id in proof matches game state
        let proof_map_id = extract_u8(&proof, 68);
        assert!(
            proof_map_id == game.map_index as u8,
            "proof map_id does not match game state"
        );

        // Verify the jungle_move proof
        Self::verify_proof(&env, &DataKey::MoveVk, &proof)?;

        game.prey_commitment = new_commitment;

        check_prey_survival(&env, &key, &mut game);

        Ok(())
    }

    /// Prey exits jungle (reveals position, becomes visible).
    pub fn prey_exit_jungle(
        env: Env,
        session_id: u32,
        x: u32,
        y: u32,
    ) -> Result<(), Error> {
        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::PreyTurn {
            return Err(Error::WrongPhase);
        }

        game.prey.require_auth();

        if game.prey_is_frozen {
            return Err(Error::PreyFrozen);
        }

        if !game.prey_is_hidden {
            return Err(Error::PreyNotHidden);
        }

        if x >= 8 || y >= 8 {
            return Err(Error::OutOfBounds);
        }

        // Must exit to plains
        let idx = (y * 8 + x) as usize;
        if MAPS[game.map_index as usize][idx] == 1 {
            return Err(Error::IsJungle);
        }

        game.prey_x = x;
        game.prey_y = y;
        game.prey_is_hidden = false;
        game.prey_commitment = BytesN::from_array(&env, &[0u8; 32]);

        check_prey_survival(&env, &key, &mut game);

        Ok(())
    }

    /// Prey responds to a search with a single batched ZK proof of non-presence.
    ///
    /// The proof's public inputs must match the on-chain game state:
    /// - commitment must equal game.prey_commitment
    /// - searched_x/y arrays must match game.searched_tiles_x/y (padded with 255 to length 9)
    ///
    /// Proof blob layout (after 4-byte num_fields header):
    ///   bytes 4..36:    commitment (32 bytes, Field)
    ///   bytes 36..324:  searched_x[0..9] (9 * 32 bytes, u8 in last byte)
    ///   bytes 324..612: searched_y[0..9] (9 * 32 bytes, u8 in last byte)
    pub fn respond_search(
        env: Env,
        session_id: u32,
        proof: Bytes,
    ) -> Result<(), Error> {
        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::SearchPending {
            return Err(Error::WrongPhase);
        }

        game.prey.require_auth();

        // Empty proof = prey concedes (hunter found them)
        if proof.len() == 0 {
            game.searched_tiles_x = vec![&env];
            game.searched_tiles_y = vec![&env];
            end_round(&env, &key, &mut game, true);
            return Ok(());
        }

        // --- Verify public inputs match game state ---

        // Extract commitment from proof (bytes 4..36)
        let proof_commitment = extract_bytes32(&proof, 4);
        assert!(
            proof_commitment == game.prey_commitment,
            "proof commitment does not match game state"
        );

        // Extract searched_x[0..9] from proof (bytes 36..324, each 32 bytes, u8 in last byte)
        let num_tiles = game.searched_tiles_x.len();
        for i in 0..9u32 {
            let proof_sx = extract_u8(&proof, 36 + i * 32);
            let proof_sy = extract_u8(&proof, 324 + i * 32);

            if i < num_tiles {
                let expected_x = game.searched_tiles_x.get(i).unwrap() as u8;
                let expected_y = game.searched_tiles_y.get(i).unwrap() as u8;
                assert!(
                    proof_sx == expected_x && proof_sy == expected_y,
                    "proof searched tile does not match game state"
                );
            } else {
                // Padded slots must be 255
                assert!(
                    proof_sx == 255 && proof_sy == 255,
                    "proof padding must be 255"
                );
            }
        }

        // --- Verify the ZK proof ---
        Self::verify_proof(&env, &DataKey::SearchVk, &proof)?;

        // All searches responded in one proof, prey is safe
        game.searched_tiles_x = vec![&env];
        game.searched_tiles_y = vec![&env];
        game.phase = GamePhase::PreyTurn;

        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        Ok(())
    }

    /// Hunter uses EMP to freeze visible prey for 1 turn (global range, 1 use per round).
    pub fn hunter_emp(env: Env, session_id: u32) -> Result<(), Error> {
        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::HunterTurn {
            return Err(Error::WrongPhase);
        }

        game.hunter.require_auth();

        if game.emp_uses_remaining == 0 {
            return Err(Error::NoEMP);
        }

        if game.prey_is_hidden {
            return Err(Error::EmpTargetHidden);
        }

        game.prey_is_frozen = true;
        game.emp_uses_remaining -= 1;
        // Phase stays HunterTurn — hunter can still move this turn

        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        Ok(())
    }

    /// Frozen prey skips their turn (called automatically by frontend).
    pub fn prey_pass_frozen(env: Env, session_id: u32) -> Result<(), Error> {
        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::PreyTurn {
            return Err(Error::WrongPhase);
        }

        game.prey.require_auth();

        if !game.prey_is_frozen {
            return Err(Error::WrongPhase);
        }

        game.prey_is_frozen = false;

        check_prey_survival(&env, &key, &mut game);

        Ok(())
    }

    /// Prey dashes up to 2 tiles on plains in a single move (2 uses per turn).
    pub fn prey_dash_public(
        env: Env,
        session_id: u32,
        x: u32,
        y: u32,
    ) -> Result<(), Error> {
        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::PreyTurn {
            return Err(Error::WrongPhase);
        }

        game.prey.require_auth();

        if game.prey_is_frozen {
            return Err(Error::PreyFrozen);
        }

        if game.prey_dash_remaining == 0 {
            return Err(Error::NoDashes);
        }

        if x >= 8 || y >= 8 {
            return Err(Error::OutOfBounds);
        }

        // Must move to plains
        let idx = (y * 8 + x) as usize;
        if MAPS[game.map_index as usize][idx] == 1 {
            return Err(Error::IsJungle);
        }

        // Dash distance: Manhattan <= 2
        let dx = abs_diff(x, game.prey_x);
        let dy = abs_diff(y, game.prey_y);
        if dx + dy > 2 {
            return Err(Error::InvalidMove);
        }

        game.prey_dash_remaining -= 1;
        game.prey_x = x;
        game.prey_y = y;
        game.prey_is_hidden = false;

        check_prey_survival(&env, &key, &mut game);

        Ok(())
    }

    /// Hunter claims catch (prey failed to respond to search).
    pub fn claim_catch(env: Env, session_id: u32) -> Result<Address, Error> {
        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::SearchPending {
            return Err(Error::WrongPhase);
        }

        game.hunter.require_auth();

        end_round(&env, &key, &mut game, true);

        let winner_or_hunter = game.winner.clone().unwrap_or(game.hunter.clone());
        Ok(winner_or_hunter)
    }

    /// Read game state (for frontend polling).
    pub fn get_game(env: Env, session_id: u32) -> Result<Game, Error> {
        let key = DataKey::Game(session_id);
        env.storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)
    }

    // ========================================================================
    // Internal helpers
    // ========================================================================

    fn verify_proof(env: &Env, vk_key: &DataKey, proof: &Bytes) -> Result<(), Error> {
        let ultrahonk_addr = Address::from_str(env, ULTRAHONK_CONTRACT_ADDRESS);
        let ultrahonk_client = ultrahonk_contract::Client::new(env, &ultrahonk_addr);

        let vk: Bytes = env
            .storage()
            .instance()
            .get(vk_key)
            .expect("VK not set");

        ultrahonk_client.verify_proof(&vk, proof);

        Ok(())
    }

    // ========================================================================
    // Admin Functions
    // ========================================================================

    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set")
    }

    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

// ============================================================================
// Game Hub Notifications
// ============================================================================

/// Notify the Game Hub that a game session started.
/// Silently skipped if no GameHub address is configured (local dev).
fn notify_game_hub_start(env: &Env, session_id: u32, player1: Address, player2: Address) {
    if let Some(hub_addr) = env
        .storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::GameHubAddress)
    {
        let game_id = env.current_contract_address();
        let args: Vec<Val> = vec![
            env,
            game_id.into_val(env),
            session_id.into_val(env),
            player1.into_val(env),
            player2.into_val(env),
            0i128.into_val(env),
            0i128.into_val(env),
        ];
        env.invoke_contract::<Val>(&hub_addr, &Symbol::new(env, "start_game"), args);
    }
}

/// Notify the Game Hub that the game ended.
/// Silently skipped if no GameHub address is configured (local dev).
fn notify_game_hub_end(env: &Env, session_id: u32, player1_won: bool) {
    if let Some(hub_addr) = env
        .storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::GameHubAddress)
    {
        let args: Vec<Val> = vec![
            env,
            session_id.into_val(env),
            player1_won.into_val(env),
        ];
        env.invoke_contract::<Val>(&hub_addr, &Symbol::new(env, "end_game"), args);
    }
}

// ============================================================================
// Utility
// ============================================================================

fn abs_diff(a: u32, b: u32) -> u32 {
    if a > b { a - b } else { b - a }
}

/// Select a random map index from the pool using the environment PRNG.
fn select_random_map(env: &Env) -> u32 {
    (env.prng().gen_range::<u64>(0..MAP_COUNT as u64)) as u32
}

/// Pick random starting positions on plains with Manhattan distance >= MIN_SPAWN_DISTANCE.
fn random_starting_positions(env: &Env, map_index: u32) -> (u32, u32, u32, u32) {
    let map = &MAPS[map_index as usize];

    // Collect all plains tiles
    let mut plains_indices: [u32; 64] = [0; 64];
    let mut count: u32 = 0;
    for i in 0u32..64 {
        if map[i as usize] == 0 {
            plains_indices[count as usize] = i;
            count += 1;
        }
    }

    // Try random pairs until we find one with sufficient distance
    loop {
        let a = (env.prng().gen_range::<u64>(0..count as u64)) as u32;
        let b = (env.prng().gen_range::<u64>(0..count as u64)) as u32;
        if a == b {
            continue;
        }
        let idx_a = plains_indices[a as usize];
        let idx_b = plains_indices[b as usize];
        let ax = idx_a % 8;
        let ay = idx_a / 8;
        let bx = idx_b % 8;
        let by = idx_b / 8;
        let dist = abs_diff(ax, bx) + abs_diff(ay, by);
        if dist >= MIN_SPAWN_DISTANCE {
            return (ax, ay, bx, by);
        }
    }
}

/// Extract a 32-byte value from the proof blob at the given byte offset.
fn extract_bytes32(proof: &Bytes, offset: u32) -> BytesN<32> {
    let mut arr = [0u8; 32];
    for i in 0..32u32 {
        arr[i as usize] = proof.get(offset + i).expect("proof too short");
    }
    BytesN::from_array(proof.env(), &arr)
}

/// Extract a u8 value from the last byte of a 32-byte field in the proof blob.
/// Each public input occupies 32 bytes; for u8 values the meaningful byte is the last one.
fn extract_u8(proof: &Bytes, offset: u32) -> u8 {
    proof.get(offset + 31).expect("proof too short")
}

/// Check if prey survived enough turns; otherwise advance to HunterTurn.
fn check_prey_survival(env: &Env, key: &DataKey, game: &mut Game) {
    game.turn_number += 1;

    if game.turn_number > MAX_TURNS {
        // Prey survived — hunter loses this round
        end_round(env, key, game, false);
    } else {
        game.phase = GamePhase::HunterTurn;
        env.storage().temporary().set(key, game);
        env.storage()
            .temporary()
            .extend_ttl(key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);
    }
}

/// End the current round and either start the next round or end the match.
///
/// `hunter_won_round`: true if the hunter caught the prey this round.
fn end_round(env: &Env, key: &DataKey, game: &mut Game, hunter_won_round: bool) {
    // Award point to the correct player (based on fixed identity, not current role)
    if hunter_won_round {
        // The current hunter wins this round
        if game.hunter == game.player1 {
            game.player1_score += 1;
        } else {
            game.player2_score += 1;
        }
    } else {
        // The current prey wins this round (survived)
        if game.prey == game.player1 {
            game.player1_score += 1;
        } else {
            game.player2_score += 1;
        }
    }

    // Check if match is over
    if game.round >= TOTAL_ROUNDS {
        // Determine overall winner
        let player1_won = game.player1_score >= game.player2_score;
        if game.player1_score > game.player2_score {
            game.winner = Some(game.player1.clone());
        } else if game.player2_score > game.player1_score {
            game.winner = Some(game.player2.clone());
        }
        // else: draw — winner stays None (but GameHub defaults to player1)
        game.phase = GamePhase::Ended;
        env.storage().temporary().set(key, game);

        // Notify Game Hub that the game ended
        let session_id = match key {
            DataKey::Game(id) => *id,
            _ => 0,
        };
        notify_game_hub_end(env, session_id, player1_won);

        return;
    }

    // Advance to next round
    game.round += 1;

    // Swap roles if crossing the half-way point (round ROUNDS_PER_SIDE+1)
    if game.round == ROUNDS_PER_SIDE + 1 {
        let old_hunter = game.hunter.clone();
        game.hunter = game.prey.clone();
        game.prey = old_hunter;
    }

    // Select new random map and starting positions for next round
    let new_map_index = select_random_map(env);
    let (hx, hy, px, py) = random_starting_positions(env, new_map_index);
    game.map_index = new_map_index;
    game.hunter_x = hx;
    game.hunter_y = hy;
    game.prey_x = px;
    game.prey_y = py;
    game.prey_is_hidden = false;
    game.prey_commitment = BytesN::from_array(env, &[0u8; 32]);
    game.turn_number = 1;
    game.power_searches_remaining = POWER_SEARCHES_INITIAL;
    game.searched_tiles_x = vec![env];
    game.searched_tiles_y = vec![env];
    game.emp_uses_remaining = 1;
    game.prey_is_frozen = false;
    game.prey_dash_remaining = 2;
    game.phase = GamePhase::HunterTurn;

    env.storage().temporary().set(key, game);
    env.storage()
        .temporary()
        .extend_ttl(key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod test;
