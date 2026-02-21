import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export const Errors = {
  1: {message:"GameNotFound"},
  2: {message:"NotPlayer"},
  3: {message:"WrongPhase"},
  4: {message:"NotHunter"},
  5: {message:"NotPrey"},
  6: {message:"OutOfBounds"},
  7: {message:"InvalidMove"},
  8: {message:"NotJungle"},
  9: {message:"ProofFailed"},
  10: {message:"GameAlreadyEnded"},
  11: {message:"NotAdjacentJungle"},
  12: {message:"SearchPending"},
  13: {message:"NoPowerSearches"},
  14: {message:"PreyNotHidden"},
  15: {message:"PreyAlreadyHidden"},
  16: {message:"IsJungle"},
  17: {message:"NoEMP"},
  18: {message:"EmpTargetHidden"},
  19: {message:"EmpOutOfRange"},
  20: {message:"NoDashes"},
  21: {message:"PreyFrozen"}
}

export enum GamePhase {
  WaitingForPlayer2 = 0,
  HunterTurn = 1,
  PreyTurn = 2,
  SearchPending = 3,
  Ended = 4,
}


export interface Game {
  emp_uses_remaining: u32;
  hunter: string;
  hunter_x: u32;
  hunter_y: u32;
  map_index: u32;
  phase: GamePhase;
  player1: string;
  player1_score: u32;
  player2: string;
  player2_score: u32;
  power_searches_remaining: u32;
  prey: string;
  prey_commitment: Buffer;
  prey_dash_remaining: u32;
  prey_is_frozen: boolean;
  prey_is_hidden: boolean;
  prey_x: u32;
  prey_y: u32;
  round: u32;
  searched_tiles_x: Array<u32>;
  searched_tiles_y: Array<u32>;
  total_rounds: u32;
  turn_number: u32;
  winner: Option<string>;
}

export type DataKey = {tag: "Game", values: readonly [u32]} | {tag: "Admin", values: void} | {tag: "MoveVk", values: void} | {tag: "SearchVk", values: void} | {tag: "NextSessionId", values: void} | {tag: "GameHubAddress", values: void};

export interface Client {
  /**
   * Construct and simulate a set_vks transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set verification keys (called post-deploy by admin).
   */
  set_vks: ({move_vk, search_vk}: {move_vk: Buffer, search_vk: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_game_hub transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set the Game Hub contract address (called post-deploy by admin).
   * If not set, GameHub notifications are silently skipped (local dev).
   */
  set_game_hub: ({game_hub}: {game_hub: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a create_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a new game. Caller becomes the Hunter.
   */
  create_game: ({hunter}: {hunter: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a join_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Prey joins an existing game.
   */
  join_game: ({session_id, prey}: {session_id: u32, prey: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a hunter_move transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Hunter moves to an adjacent tile (public movement).
   */
  hunter_move: ({session_id, x, y}: {session_id: u32, x: u32, y: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a hunter_search transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Hunter searches one adjacent jungle tile for the Prey.
   */
  hunter_search: ({session_id, x, y}: {session_id: u32, x: u32, y: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a hunter_power_search transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Hunter uses power search to search ALL adjacent jungle tiles (limited uses).
   */
  hunter_power_search: ({session_id}: {session_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a prey_move_public transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Prey moves publicly on plains (visible to visible).
   */
  prey_move_public: ({session_id, x, y}: {session_id: u32, x: u32, y: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a prey_enter_jungle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Prey enters jungle from a visible position (becomes hidden).
   */
  prey_enter_jungle: ({session_id, new_commitment, proof}: {session_id: u32, new_commitment: Buffer, proof: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a prey_move_jungle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Prey moves within jungle (hidden to hidden).
   */
  prey_move_jungle: ({session_id, new_commitment, proof}: {session_id: u32, new_commitment: Buffer, proof: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a prey_exit_jungle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Prey exits jungle (reveals position, becomes visible).
   */
  prey_exit_jungle: ({session_id, x, y}: {session_id: u32, x: u32, y: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a respond_search transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Prey responds to a search with a single batched ZK proof of non-presence.
   * 
   * The proof's public inputs must match the on-chain game state:
   * - commitment must equal game.prey_commitment
   * - searched_x/y arrays must match game.searched_tiles_x/y (padded with 255 to length 9)
   * 
   * Proof blob layout (after 4-byte num_fields header):
   * bytes 4..36:    commitment (32 bytes, Field)
   * bytes 36..324:  searched_x[0..9] (9 * 32 bytes, u8 in last byte)
   * bytes 324..612: searched_y[0..9] (9 * 32 bytes, u8 in last byte)
   */
  respond_search: ({session_id, proof}: {session_id: u32, proof: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a hunter_emp transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Hunter uses EMP to freeze visible prey for 1 turn (global range, 1 use per round).
   */
  hunter_emp: ({session_id}: {session_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a prey_pass_frozen transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Frozen prey skips their turn (called automatically by frontend).
   */
  prey_pass_frozen: ({session_id}: {session_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a prey_dash_public transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Prey dashes up to 2 tiles on plains in a single move (2 uses per turn).
   */
  prey_dash_public: ({session_id, x, y}: {session_id: u32, x: u32, y: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a claim_catch transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Hunter claims catch (prey failed to respond to search).
   */
  claim_catch: ({session_id}: {session_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a get_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Read game state (for frontend polling).
   */
  get_game: ({session_id}: {session_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Game>>>

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin}: {admin: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAFQAAAAAAAAAMR2FtZU5vdEZvdW5kAAAAAQAAAAAAAAAJTm90UGxheWVyAAAAAAAAAgAAAAAAAAAKV3JvbmdQaGFzZQAAAAAAAwAAAAAAAAAJTm90SHVudGVyAAAAAAAABAAAAAAAAAAHTm90UHJleQAAAAAFAAAAAAAAAAtPdXRPZkJvdW5kcwAAAAAGAAAAAAAAAAtJbnZhbGlkTW92ZQAAAAAHAAAAAAAAAAlOb3RKdW5nbGUAAAAAAAAIAAAAAAAAAAtQcm9vZkZhaWxlZAAAAAAJAAAAAAAAABBHYW1lQWxyZWFkeUVuZGVkAAAACgAAAAAAAAARTm90QWRqYWNlbnRKdW5nbGUAAAAAAAALAAAAAAAAAA1TZWFyY2hQZW5kaW5nAAAAAAAADAAAAAAAAAAPTm9Qb3dlclNlYXJjaGVzAAAAAA0AAAAAAAAADVByZXlOb3RIaWRkZW4AAAAAAAAOAAAAAAAAABFQcmV5QWxyZWFkeUhpZGRlbgAAAAAAAA8AAAAAAAAACElzSnVuZ2xlAAAAEAAAAAAAAAAFTm9FTVAAAAAAAAARAAAAAAAAAA9FbXBUYXJnZXRIaWRkZW4AAAAAEgAAAAAAAAANRW1wT3V0T2ZSYW5nZQAAAAAAABMAAAAAAAAACE5vRGFzaGVzAAAAFAAAAAAAAAAKUHJleUZyb3plbgAAAAAAFQ==",
        "AAAAAwAAAAAAAAAAAAAACUdhbWVQaGFzZQAAAAAAAAUAAAAAAAAAEVdhaXRpbmdGb3JQbGF5ZXIyAAAAAAAAAAAAAAAAAAAKSHVudGVyVHVybgAAAAAAAQAAAAAAAAAIUHJleVR1cm4AAAACAAAAAAAAAA1TZWFyY2hQZW5kaW5nAAAAAAAAAwAAAAAAAAAFRW5kZWQAAAAAAAAE",
        "AAAAAQAAAAAAAAAAAAAABEdhbWUAAAAYAAAAAAAAABJlbXBfdXNlc19yZW1haW5pbmcAAAAAAAQAAAAAAAAABmh1bnRlcgAAAAAAEwAAAAAAAAAIaHVudGVyX3gAAAAEAAAAAAAAAAhodW50ZXJfeQAAAAQAAAAAAAAACW1hcF9pbmRleAAAAAAAAAQAAAAAAAAABXBoYXNlAAAAAAAH0AAAAAlHYW1lUGhhc2UAAAAAAAAAAAAAB3BsYXllcjEAAAAAEwAAAAAAAAANcGxheWVyMV9zY29yZQAAAAAAAAQAAAAAAAAAB3BsYXllcjIAAAAAEwAAAAAAAAANcGxheWVyMl9zY29yZQAAAAAAAAQAAAAAAAAAGHBvd2VyX3NlYXJjaGVzX3JlbWFpbmluZwAAAAQAAAAAAAAABHByZXkAAAATAAAAAAAAAA9wcmV5X2NvbW1pdG1lbnQAAAAD7gAAACAAAAAAAAAAE3ByZXlfZGFzaF9yZW1haW5pbmcAAAAABAAAAAAAAAAOcHJleV9pc19mcm96ZW4AAAAAAAEAAAAAAAAADnByZXlfaXNfaGlkZGVuAAAAAAABAAAAAAAAAAZwcmV5X3gAAAAAAAQAAAAAAAAABnByZXlfeQAAAAAABAAAAAAAAAAFcm91bmQAAAAAAAAEAAAAAAAAABBzZWFyY2hlZF90aWxlc194AAAD6gAAAAQAAAAAAAAAEHNlYXJjaGVkX3RpbGVzX3kAAAPqAAAABAAAAAAAAAAMdG90YWxfcm91bmRzAAAABAAAAAAAAAALdHVybl9udW1iZXIAAAAABAAAAAAAAAAGd2lubmVyAAAAAAPoAAAAEw==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABgAAAAEAAAAAAAAABEdhbWUAAAABAAAABAAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAGTW92ZVZrAAAAAAAAAAAAAAAAAAhTZWFyY2hWawAAAAAAAAAAAAAADU5leHRTZXNzaW9uSWQAAAAAAAAAAAAAAAAAAA5HYW1lSHViQWRkcmVzcwAA",
        "AAAAAAAAACZJbml0aWFsaXplIHRoZSBjb250cmFjdCB3aXRoIGFuIGFkbWluLgAAAAAADV9fY29uc3RydWN0b3IAAAAAAAABAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAA",
        "AAAAAAAAADRTZXQgdmVyaWZpY2F0aW9uIGtleXMgKGNhbGxlZCBwb3N0LWRlcGxveSBieSBhZG1pbikuAAAAB3NldF92a3MAAAAAAgAAAAAAAAAHbW92ZV92awAAAAAOAAAAAAAAAAlzZWFyY2hfdmsAAAAAAAAOAAAAAA==",
        "AAAAAAAAAIRTZXQgdGhlIEdhbWUgSHViIGNvbnRyYWN0IGFkZHJlc3MgKGNhbGxlZCBwb3N0LWRlcGxveSBieSBhZG1pbikuCklmIG5vdCBzZXQsIEdhbWVIdWIgbm90aWZpY2F0aW9ucyBhcmUgc2lsZW50bHkgc2tpcHBlZCAobG9jYWwgZGV2KS4AAAAMc2V0X2dhbWVfaHViAAAAAQAAAAAAAAAIZ2FtZV9odWIAAAATAAAAAA==",
        "AAAAAAAAAC1DcmVhdGUgYSBuZXcgZ2FtZS4gQ2FsbGVyIGJlY29tZXMgdGhlIEh1bnRlci4AAAAAAAALY3JlYXRlX2dhbWUAAAAAAQAAAAAAAAAGaHVudGVyAAAAAAATAAAAAQAAAAQ=",
        "AAAAAAAAABxQcmV5IGpvaW5zIGFuIGV4aXN0aW5nIGdhbWUuAAAACWpvaW5fZ2FtZQAAAAAAAAIAAAAAAAAACnNlc3Npb25faWQAAAAAAAQAAAAAAAAABHByZXkAAAATAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAADNIdW50ZXIgbW92ZXMgdG8gYW4gYWRqYWNlbnQgdGlsZSAocHVibGljIG1vdmVtZW50KS4AAAAAC2h1bnRlcl9tb3ZlAAAAAAMAAAAAAAAACnNlc3Npb25faWQAAAAAAAQAAAAAAAAAAXgAAAAAAAAEAAAAAAAAAAF5AAAAAAAABAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAADZIdW50ZXIgc2VhcmNoZXMgb25lIGFkamFjZW50IGp1bmdsZSB0aWxlIGZvciB0aGUgUHJleS4AAAAAAA1odW50ZXJfc2VhcmNoAAAAAAAAAwAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAAAAAABeAAAAAAAAAQAAAAAAAAAAXkAAAAAAAAEAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAExIdW50ZXIgdXNlcyBwb3dlciBzZWFyY2ggdG8gc2VhcmNoIEFMTCBhZGphY2VudCBqdW5nbGUgdGlsZXMgKGxpbWl0ZWQgdXNlcykuAAAAE2h1bnRlcl9wb3dlcl9zZWFyY2gAAAAAAQAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAADNQcmV5IG1vdmVzIHB1YmxpY2x5IG9uIHBsYWlucyAodmlzaWJsZSB0byB2aXNpYmxlKS4AAAAAEHByZXlfbW92ZV9wdWJsaWMAAAADAAAAAAAAAApzZXNzaW9uX2lkAAAAAAAEAAAAAAAAAAF4AAAAAAAABAAAAAAAAAABeQAAAAAAAAQAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAADxQcmV5IGVudGVycyBqdW5nbGUgZnJvbSBhIHZpc2libGUgcG9zaXRpb24gKGJlY29tZXMgaGlkZGVuKS4AAAARcHJleV9lbnRlcl9qdW5nbGUAAAAAAAADAAAAAAAAAApzZXNzaW9uX2lkAAAAAAAEAAAAAAAAAA5uZXdfY29tbWl0bWVudAAAAAAD7gAAACAAAAAAAAAABXByb29mAAAAAAAADgAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAACxQcmV5IG1vdmVzIHdpdGhpbiBqdW5nbGUgKGhpZGRlbiB0byBoaWRkZW4pLgAAABBwcmV5X21vdmVfanVuZ2xlAAAAAwAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAAAAAAObmV3X2NvbW1pdG1lbnQAAAAAA+4AAAAgAAAAAAAAAAVwcm9vZgAAAAAAAA4AAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAADZQcmV5IGV4aXRzIGp1bmdsZSAocmV2ZWFscyBwb3NpdGlvbiwgYmVjb21lcyB2aXNpYmxlKS4AAAAAABBwcmV5X2V4aXRfanVuZ2xlAAAAAwAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAAAAAABeAAAAAAAAAQAAAAAAAAAAXkAAAAAAAAEAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAfBQcmV5IHJlc3BvbmRzIHRvIGEgc2VhcmNoIHdpdGggYSBzaW5nbGUgYmF0Y2hlZCBaSyBwcm9vZiBvZiBub24tcHJlc2VuY2UuCgpUaGUgcHJvb2YncyBwdWJsaWMgaW5wdXRzIG11c3QgbWF0Y2ggdGhlIG9uLWNoYWluIGdhbWUgc3RhdGU6Ci0gY29tbWl0bWVudCBtdXN0IGVxdWFsIGdhbWUucHJleV9jb21taXRtZW50Ci0gc2VhcmNoZWRfeC95IGFycmF5cyBtdXN0IG1hdGNoIGdhbWUuc2VhcmNoZWRfdGlsZXNfeC95IChwYWRkZWQgd2l0aCAyNTUgdG8gbGVuZ3RoIDkpCgpQcm9vZiBibG9iIGxheW91dCAoYWZ0ZXIgNC1ieXRlIG51bV9maWVsZHMgaGVhZGVyKToKYnl0ZXMgNC4uMzY6ICAgIGNvbW1pdG1lbnQgKDMyIGJ5dGVzLCBGaWVsZCkKYnl0ZXMgMzYuLjMyNDogIHNlYXJjaGVkX3hbMC4uOV0gKDkgKiAzMiBieXRlcywgdTggaW4gbGFzdCBieXRlKQpieXRlcyAzMjQuLjYxMjogc2VhcmNoZWRfeVswLi45XSAoOSAqIDMyIGJ5dGVzLCB1OCBpbiBsYXN0IGJ5dGUpAAAADnJlc3BvbmRfc2VhcmNoAAAAAAACAAAAAAAAAApzZXNzaW9uX2lkAAAAAAAEAAAAAAAAAAVwcm9vZgAAAAAAAA4AAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAFJIdW50ZXIgdXNlcyBFTVAgdG8gZnJlZXplIHZpc2libGUgcHJleSBmb3IgMSB0dXJuIChnbG9iYWwgcmFuZ2UsIDEgdXNlIHBlciByb3VuZCkuAAAAAAAKaHVudGVyX2VtcAAAAAAAAQAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAEBGcm96ZW4gcHJleSBza2lwcyB0aGVpciB0dXJuIChjYWxsZWQgYXV0b21hdGljYWxseSBieSBmcm9udGVuZCkuAAAAEHByZXlfcGFzc19mcm96ZW4AAAABAAAAAAAAAApzZXNzaW9uX2lkAAAAAAAEAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAEdQcmV5IGRhc2hlcyB1cCB0byAyIHRpbGVzIG9uIHBsYWlucyBpbiBhIHNpbmdsZSBtb3ZlICgyIHVzZXMgcGVyIHR1cm4pLgAAAAAQcHJleV9kYXNoX3B1YmxpYwAAAAMAAAAAAAAACnNlc3Npb25faWQAAAAAAAQAAAAAAAAAAXgAAAAAAAAEAAAAAAAAAAF5AAAAAAAABAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAADdIdW50ZXIgY2xhaW1zIGNhdGNoIChwcmV5IGZhaWxlZCB0byByZXNwb25kIHRvIHNlYXJjaCkuAAAAAAtjbGFpbV9jYXRjaAAAAAABAAAAAAAAAApzZXNzaW9uX2lkAAAAAAAEAAAAAQAAA+kAAAATAAAAAw==",
        "AAAAAAAAACdSZWFkIGdhbWUgc3RhdGUgKGZvciBmcm9udGVuZCBwb2xsaW5nKS4AAAAACGdldF9nYW1lAAAAAQAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAEAAAPpAAAH0AAAAARHYW1lAAAAAw==",
        "AAAAAAAAAAAAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA" ]),
      options
    )
  }
  public readonly fromJSON = {
    set_vks: this.txFromJSON<null>,
        set_game_hub: this.txFromJSON<null>,
        create_game: this.txFromJSON<u32>,
        join_game: this.txFromJSON<Result<void>>,
        hunter_move: this.txFromJSON<Result<void>>,
        hunter_search: this.txFromJSON<Result<void>>,
        hunter_power_search: this.txFromJSON<Result<void>>,
        prey_move_public: this.txFromJSON<Result<void>>,
        prey_enter_jungle: this.txFromJSON<Result<void>>,
        prey_move_jungle: this.txFromJSON<Result<void>>,
        prey_exit_jungle: this.txFromJSON<Result<void>>,
        respond_search: this.txFromJSON<Result<void>>,
        hunter_emp: this.txFromJSON<Result<void>>,
        prey_pass_frozen: this.txFromJSON<Result<void>>,
        prey_dash_public: this.txFromJSON<Result<void>>,
        claim_catch: this.txFromJSON<Result<string>>,
        get_game: this.txFromJSON<Result<Game>>,
        get_admin: this.txFromJSON<string>,
        set_admin: this.txFromJSON<null>,
        upgrade: this.txFromJSON<null>
  }
}