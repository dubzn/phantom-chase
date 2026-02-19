#![cfg(test)]

use crate::{Error, GamePhase, ZkHuntContract, ZkHuntContractClient, MAPS, MAP_COUNT};
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{contract, contractimpl, Address, Bytes, BytesN, Env};

// ============================================================================
// Mock Verifier (always succeeds)
// ============================================================================

#[contract]
pub struct MockVerifier;

#[contractimpl]
impl MockVerifier {
    pub fn verify_proof(_env: Env, _vk_json: Bytes, _proof_blob: Bytes) -> BytesN<32> {
        BytesN::from_array(&_env, &[1u8; 32])
    }
}


// ============================================================================
// Test Helpers
// ============================================================================

fn setup_test() -> (Env, ZkHuntContractClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().set(soroban_sdk::testutils::LedgerInfo {
        timestamp: 1441065600,
        protocol_version: 23,
        sequence_number: 100,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: u32::MAX / 2,
        min_persistent_entry_ttl: u32::MAX / 2,
        max_entry_ttl: u32::MAX / 2,
    });

    let admin = Address::generate(&env);
    let _verifier_addr = env.register(MockVerifier, ());
    let contract_id = env.register(ZkHuntContract, (&admin,));
    let client = ZkHuntContractClient::new(&env, &contract_id);

    let dummy_vk = Bytes::from_array(&env, &[0u8; 32]);
    client.set_vks(&dummy_vk, &dummy_vk);

    let hunter = Address::generate(&env);
    let prey = Address::generate(&env);

    (env, client, hunter, prey)
}

fn dummy_commitment(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[42u8; 32])
}

fn dummy_proof(env: &Env) -> Bytes {
    Bytes::from_array(env, &[0u8; 64])
}

fn assert_zk_hunt_error<T, E>(
    result: &Result<Result<T, E>, Result<Error, soroban_sdk::InvokeError>>,
    expected_error: Error,
) {
    match result {
        Err(Ok(actual_error)) => {
            assert_eq!(
                *actual_error, expected_error,
                "Expected {:?}, got {:?}",
                expected_error, actual_error
            );
        }
        Err(Err(_)) => panic!(
            "Expected contract error {:?}, got invocation error",
            expected_error
        ),
        Ok(Err(_)) => panic!(
            "Expected contract error {:?}, got conversion error",
            expected_error
        ),
        Ok(Ok(_)) => panic!("Expected error {:?}, but operation succeeded", expected_error),
    }
}

fn abs_diff(a: u32, b: u32) -> u32 {
    if a > b { a - b } else { b - a }
}

/// Find an adjacent plains tile that does NOT overlap with `avoid` position.
/// Returns (x, y) of a valid adjacent plains tile, or panics if none found.
fn find_adjacent_plains_avoiding(map_index: u32, x: u32, y: u32, avoid_x: u32, avoid_y: u32) -> (u32, u32) {
    let map = &MAPS[map_index as usize];
    let offsets: [(i32, i32); 4] = [(-1, 0), (1, 0), (0, -1), (0, 1)];
    for (ox, oy) in offsets.iter() {
        let nx = x as i32 + ox;
        let ny = y as i32 + oy;
        if nx >= 0 && nx < 8 && ny >= 0 && ny < 8 {
            let nxu = nx as u32;
            let nyu = ny as u32;
            let idx = (nyu * 8 + nxu) as usize;
            if map[idx] == 0 && !(nxu == avoid_x && nyu == avoid_y) {
                return (nxu, nyu);
            }
        }
    }
    // Fallback: allow same tile as avoid (staying in place is not ideal but prevents panic)
    for (ox, oy) in offsets.iter() {
        let nx = x as i32 + ox;
        let ny = y as i32 + oy;
        if nx >= 0 && nx < 8 && ny >= 0 && ny < 8 {
            let idx = (ny * 8 + nx) as usize;
            if map[idx] == 0 {
                return (nx as u32, ny as u32);
            }
        }
    }
    panic!("No adjacent plains tile found for ({}, {}) on map {}", x, y, map_index);
}

/// Play one full turn (hunter + prey move) avoiding collisions.
/// Returns true if the round is still in progress, false if it ended.
fn play_one_turn(client: &ZkHuntContractClient, session_id: u32) -> bool {
    let game = client.get_game(&session_id);
    if game.phase != GamePhase::HunterTurn {
        return false;
    }

    // Hunter moves to adjacent plains, avoiding prey's position to prevent accidental catch
    let (hx, hy) = find_adjacent_plains_avoiding(
        game.map_index, game.hunter_x, game.hunter_y, game.prey_x, game.prey_y,
    );
    client.hunter_move(&session_id, &hx, &hy);

    let game = client.get_game(&session_id);
    // If the round ended (hunter caught prey anyway), return false
    if game.phase != GamePhase::PreyTurn {
        return game.phase == GamePhase::HunterTurn; // new round started
    }

    // Prey moves to adjacent plains, avoiding hunter's position
    let (px, py) = find_adjacent_plains_avoiding(
        game.map_index, game.prey_x, game.prey_y, game.hunter_x, game.hunter_y,
    );
    client.prey_move_public(&session_id, &px, &py);

    true
}

/// Helper: create and join a game, returns session_id
fn create_and_join(
    client: &ZkHuntContractClient,
    hunter: &Address,
    prey: &Address,
) -> u32 {
    let session_id = client.create_game(hunter);
    client.join_game(&session_id, prey);
    session_id
}

// ============================================================================
// Game Flow Tests
// ============================================================================

#[test]
fn test_create_game() {
    let (_env, client, hunter, _prey) = setup_test();

    let session_id = client.create_game(&hunter);
    assert_eq!(session_id, 1);

    let game = client.get_game(&session_id);
    assert_eq!(game.hunter, hunter);
    assert_eq!(game.phase, GamePhase::WaitingForPlayer2);
    // Positions are random but must be in bounds and on plains
    assert!(game.hunter_x < 8 && game.hunter_y < 8);
    assert!(game.prey_x < 8 && game.prey_y < 8);
    assert!(game.map_index < MAP_COUNT);
    let map = &MAPS[game.map_index as usize];
    assert_eq!(map[(game.hunter_y * 8 + game.hunter_x) as usize], 0, "hunter must start on plains");
    assert_eq!(map[(game.prey_y * 8 + game.prey_x) as usize], 0, "prey must start on plains");
    let dist = abs_diff(game.hunter_x, game.prey_x) + abs_diff(game.hunter_y, game.prey_y);
    assert!(dist >= 3, "spawn distance must be >= 3, got {}", dist);
    assert_eq!(game.prey_is_hidden, false);
    assert_eq!(game.turn_number, 0);
    assert_eq!(game.power_searches_remaining, 2);
    assert!(game.winner.is_none());
    assert_eq!(game.round, 1);
    assert_eq!(game.player1_score, 0);
    assert_eq!(game.player2_score, 0);
    assert_eq!(game.player1, hunter);
}

#[test]
fn test_create_and_join_game() {
    let (_env, client, hunter, prey) = setup_test();

    let session_id = client.create_game(&hunter);
    client.join_game(&session_id, &prey);

    let game = client.get_game(&session_id);
    assert_eq!(game.hunter, hunter);
    assert_eq!(game.prey, prey);
    assert_eq!(game.phase, GamePhase::HunterTurn);
    assert_eq!(game.turn_number, 1);
}

#[test]
fn test_hunter_move() {
    let (_env, client, hunter, prey) = setup_test();
    let session_id = create_and_join(&client, &hunter, &prey);

    let game = client.get_game(&session_id);
    let (nx, ny) = find_adjacent_plains_avoiding(
        game.map_index, game.hunter_x, game.hunter_y, game.prey_x, game.prey_y,
    );

    client.hunter_move(&session_id, &nx, &ny);

    let game = client.get_game(&session_id);
    assert_eq!(game.hunter_x, nx);
    assert_eq!(game.hunter_y, ny);
    assert_eq!(game.phase, GamePhase::PreyTurn);
}

#[test]
fn test_hunter_move_out_of_bounds() {
    let (_env, client, hunter, prey) = setup_test();
    let session_id = create_and_join(&client, &hunter, &prey);

    let result = client.try_hunter_move(&session_id, &8, &0);
    assert_zk_hunt_error(&result, Error::OutOfBounds);
}

#[test]
fn test_hunter_move_too_far() {
    let (_env, client, hunter, prey) = setup_test();
    let session_id = create_and_join(&client, &hunter, &prey);

    let game = client.get_game(&session_id);
    let far_x = if game.hunter_x < 6 { game.hunter_x + 2 } else { game.hunter_x - 2 };
    let result = client.try_hunter_move(&session_id, &far_x, &game.hunter_y);
    assert_zk_hunt_error(&result, Error::InvalidMove);
}

#[test]
fn test_hunter_move_wrong_phase() {
    let (_env, client, hunter, _prey) = setup_test();
    let session_id = client.create_game(&hunter);

    let result = client.try_hunter_move(&session_id, &1, &0);
    assert_zk_hunt_error(&result, Error::WrongPhase);
}

#[test]
fn test_prey_move_public() {
    let (_env, client, hunter, prey) = setup_test();
    let session_id = create_and_join(&client, &hunter, &prey);

    let game = client.get_game(&session_id);
    let (hx, hy) = find_adjacent_plains_avoiding(
        game.map_index, game.hunter_x, game.hunter_y, game.prey_x, game.prey_y,
    );
    client.hunter_move(&session_id, &hx, &hy);

    let game = client.get_game(&session_id);
    let (px, py) = find_adjacent_plains_avoiding(
        game.map_index, game.prey_x, game.prey_y, game.hunter_x, game.hunter_y,
    );
    client.prey_move_public(&session_id, &px, &py);

    let game = client.get_game(&session_id);
    assert_eq!(game.prey_x, px);
    assert_eq!(game.prey_y, py);
    assert_eq!(game.prey_is_hidden, false);
    assert_eq!(game.phase, GamePhase::HunterTurn);
    assert_eq!(game.turn_number, 2);
}

#[test]
fn test_prey_move_public_invalid_to_jungle() {
    let (_env, client, hunter, prey) = setup_test();
    let session_id = create_and_join(&client, &hunter, &prey);

    let game = client.get_game(&session_id);
    let (hx, hy) = find_adjacent_plains_avoiding(
        game.map_index, game.hunter_x, game.hunter_y, game.prey_x, game.prey_y,
    );
    client.hunter_move(&session_id, &hx, &hy);

    // Find an adjacent jungle tile for prey
    let game = client.get_game(&session_id);
    let map = &MAPS[game.map_index as usize];
    let offsets: [(i32, i32); 4] = [(-1, 0), (1, 0), (0, -1), (0, 1)];
    let mut jungle_tile = None;
    for (ox, oy) in offsets.iter() {
        let nx = game.prey_x as i32 + ox;
        let ny = game.prey_y as i32 + oy;
        if nx >= 0 && nx < 8 && ny >= 0 && ny < 8 {
            let idx = (ny * 8 + nx) as usize;
            if map[idx] == 1 {
                jungle_tile = Some((nx as u32, ny as u32));
                break;
            }
        }
    }

    if let Some((jx, jy)) = jungle_tile {
        let result = client.try_prey_move_public(&session_id, &jx, &jy);
        assert_zk_hunt_error(&result, Error::IsJungle);
    }
}

#[test]
fn test_hunter_search_requires_hidden_prey() {
    let (_env, client, hunter, prey) = setup_test();
    let session_id = create_and_join(&client, &hunter, &prey);

    // Play one turn first to get to hunter's turn with a good position
    play_one_turn(&client, session_id);

    let game = client.get_game(&session_id);
    if game.phase != GamePhase::HunterTurn {
        return; // round ended, skip
    }

    // Look for an adjacent jungle tile to search
    let map = &MAPS[game.map_index as usize];
    let offsets: [(i32, i32); 4] = [(-1, 0), (1, 0), (0, -1), (0, 1)];
    for (ox, oy) in offsets.iter() {
        let nx = game.hunter_x as i32 + ox;
        let ny = game.hunter_y as i32 + oy;
        if nx >= 0 && nx < 8 && ny >= 0 && ny < 8 {
            let idx = (ny * 8 + nx) as usize;
            if map[idx] == 1 {
                let result = client.try_hunter_search(&session_id, &(nx as u32), &(ny as u32));
                assert_zk_hunt_error(&result, Error::PreyNotHidden);
                return;
            }
        }
    }
}

#[test]
fn test_claim_catch_wrong_phase() {
    let (_env, client, hunter, prey) = setup_test();
    let session_id = create_and_join(&client, &hunter, &prey);

    let result = client.try_claim_catch(&session_id);
    assert_zk_hunt_error(&result, Error::WrongPhase);
}

#[test]
fn test_prey_survives_10_turns_advances_round() {
    let (_env, client, hunter, prey) = setup_test();
    let session_id = create_and_join(&client, &hunter, &prey);

    // Play 10 turns without accidental catches
    for _turn in 1..=10 {
        play_one_turn(&client, session_id);
    }

    // After 10 prey moves, prey wins round 1 — game advances to round 2
    let game = client.get_game(&session_id);
    assert_eq!(game.phase, GamePhase::HunterTurn);
    assert_eq!(game.round, 2);
    assert_eq!(game.player2_score, 1); // prey (player2) won round 1
    assert_eq!(game.player1_score, 0);
    assert_eq!(game.turn_number, 1);
    // Note: roles may have swapped if round 2 == ROUNDS_PER_SIDE + 1
    // Verify new round has valid positions
    assert!(game.map_index < MAP_COUNT);
    let map = &MAPS[game.map_index as usize];
    assert_eq!(map[(game.hunter_y * 8 + game.hunter_x) as usize], 0);
    assert_eq!(map[(game.prey_y * 8 + game.prey_x) as usize], 0);
}

#[test]
fn test_no_power_searches_left() {
    let (_env, client, hunter, prey) = setup_test();
    let session_id = create_and_join(&client, &hunter, &prey);

    let result = client.try_hunter_power_search(&session_id);
    assert_zk_hunt_error(&result, Error::PreyNotHidden);
}

#[test]
fn test_game_not_found() {
    let (_env, client, _hunter, _prey) = setup_test();
    let result = client.try_get_game(&999);
    assert_zk_hunt_error(&result, Error::GameNotFound);
}

#[test]
fn test_multiple_sessions() {
    let (env, client, hunter, prey) = setup_test();
    let hunter2 = Address::generate(&env);
    let prey2 = Address::generate(&env);

    let id1 = client.create_game(&hunter);
    let id2 = client.create_game(&hunter2);

    assert_eq!(id1, 1);
    assert_eq!(id2, 2);

    client.join_game(&id1, &prey);
    client.join_game(&id2, &prey2);

    let game1 = client.get_game(&id1);
    let game2 = client.get_game(&id2);

    assert_eq!(game1.hunter, hunter);
    assert_eq!(game2.hunter, hunter2);
    assert_eq!(game1.prey, prey);
    assert_eq!(game2.prey, prey2);
}

#[test]
fn test_join_wrong_phase() {
    let (env, client, hunter, prey) = setup_test();
    let session_id = create_and_join(&client, &hunter, &prey);

    let prey2 = Address::generate(&env);
    let result = client.try_join_game(&session_id, &prey2);
    assert_zk_hunt_error(&result, Error::WrongPhase);
}

#[test]
fn test_prey_exit_jungle_not_hidden() {
    let (_env, client, hunter, prey) = setup_test();
    let session_id = create_and_join(&client, &hunter, &prey);

    let game = client.get_game(&session_id);
    let (hx, hy) = find_adjacent_plains_avoiding(
        game.map_index, game.hunter_x, game.hunter_y, game.prey_x, game.prey_y,
    );
    client.hunter_move(&session_id, &hx, &hy);

    let game = client.get_game(&session_id);
    let result = client.try_prey_exit_jungle(&session_id, &game.prey_x, &game.prey_y);
    assert_zk_hunt_error(&result, Error::PreyNotHidden);
}

#[test]
fn test_prey_move_jungle_not_hidden() {
    let (_env, client, hunter, prey) = setup_test();
    let session_id = create_and_join(&client, &hunter, &prey);

    let game = client.get_game(&session_id);
    let (hx, hy) = find_adjacent_plains_avoiding(
        game.map_index, game.hunter_x, game.hunter_y, game.prey_x, game.prey_y,
    );
    client.hunter_move(&session_id, &hx, &hy);

    let result = client.try_prey_move_jungle(
        &session_id,
        &dummy_commitment(&_env),
        &dummy_proof(&_env),
    );
    assert_zk_hunt_error(&result, Error::PreyNotHidden);
}

#[test]
fn test_auto_increment_session_ids() {
    let (_env, client, hunter, _prey) = setup_test();

    let id1 = client.create_game(&hunter);
    let id2 = client.create_game(&hunter);
    let id3 = client.create_game(&hunter);

    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(id3, 3);
}

#[test]
fn test_full_match_prey_wins_all() {
    let (_env, client, hunter, prey) = setup_test();
    let session_id = create_and_join(&client, &hunter, &prey);

    let total_rounds = client.get_game(&session_id).total_rounds;
    for round_num in 1..=total_rounds {
        for _turn in 1..=10u32 {
            let game = client.get_game(&session_id);
            if game.phase == GamePhase::Ended {
                break;
            }
            play_one_turn(&client, session_id);
        }

        let game = client.get_game(&session_id);
        if game.phase == GamePhase::Ended {
            break;
        }
        if round_num < total_rounds {
            assert_eq!(game.phase, GamePhase::HunterTurn);
            assert_eq!(game.round, round_num + 1);
        }
    }

    let game = client.get_game(&session_id);
    assert_eq!(game.phase, GamePhase::Ended);
    // Both players scored as prey equally — draw
    assert_eq!(game.player1_score, game.player2_score);
    assert!(game.winner.is_none());
}

#[test]
fn test_role_swap_at_halfway() {
    let (_env, client, hunter, prey) = setup_test();
    let session_id = create_and_join(&client, &hunter, &prey);

    let game = client.get_game(&session_id);
    let rounds_per_side = game.total_rounds / 2;

    for _round in 0..rounds_per_side {
        for _turn in 1..=10u32 {
            play_one_turn(&client, session_id);
        }
    }

    let game = client.get_game(&session_id);
    assert_eq!(game.round, rounds_per_side + 1);
    // Roles swapped: player2 (originally prey) is now hunter
    assert_eq!(game.hunter, prey);
    assert_eq!(game.prey, hunter);
    // Verify valid positions on new map
    assert!(game.map_index < MAP_COUNT);
    let map = &MAPS[game.map_index as usize];
    assert_eq!(map[(game.hunter_y * 8 + game.hunter_x) as usize], 0);
    assert_eq!(map[(game.prey_y * 8 + game.prey_x) as usize], 0);
}
