import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Buffer } from 'buffer';
import { useWallet } from '../hooks/useWallet';
import { createZkHuntClient, Game, GamePhase } from '../contracts/zk_hunt';
import {
  GameService,
  GRID_SIZE,
  MAPS,
  isJungle,
  isPlains,
  isInBounds,
  isAdjacent,
  canHunterSearch,
  canPreyDash,
  generateRandomNonce,
  type PreySecret,
} from '../services/GameService';
import { Board3D } from './board3d/Board3D';
import { GameHUD } from './GameHUD';
import { GameControls } from './GameControls';
import { WalletButton } from './WalletButton';
import { TileContextMenu } from './TileContextMenu';
import { HowToPlay } from './HowToPlay';

// --- Prey secret persistence helpers ---
const PREY_SECRET_KEY_PREFIX = 'zk-hunt-prey-';

function savePreySecret(sessionId: number, secret: PreySecret) {
  try {
    const data = { x: secret.x, y: secret.y, nonce: secret.nonce.toString() };
    localStorage.setItem(`${PREY_SECRET_KEY_PREFIX}${sessionId}`, JSON.stringify(data));
  } catch { /* localStorage unavailable */ }
}

function loadPreySecret(sessionId: number): PreySecret | null {
  try {
    const raw = localStorage.getItem(`${PREY_SECRET_KEY_PREFIX}${sessionId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return { x: data.x, y: data.y, nonce: BigInt(data.nonce) };
  } catch { return null; }
}

function clearPreySecret(sessionId: number) {
  try { localStorage.removeItem(`${PREY_SECRET_KEY_PREFIX}${sessionId}`); } catch { /* noop */ }
}

interface GameViewProps {
  sessionId: number;
  isHunter: boolean;
  onBack: () => void;
}

export const GameView: React.FC<GameViewProps> = ({ sessionId, isHunter: initialIsHunter, onBack }) => {
  const { address, signTransaction } = useWallet();
  const [game, setGame] = useState<Game | null>(null);
  const [status, setStatus] = useState('Loading game...');
  const [isActing, setIsActing] = useState(false);
  const [preySecret, setPreySecretRaw] = useState<PreySecret | null>(null);
  const setPreySecret = useCallback((secret: PreySecret) => {
    setPreySecretRaw(secret);
    savePreySecret(sessionId, secret);
  }, [sessionId]);

  const currentMap = useMemo(() => {
    if (!game) return MAPS[0];
    return MAPS[game.map_index] ?? MAPS[0];
  }, [game?.map_index]);

  const isHunter = game ? game.hunter === address : initialIsHunter;
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    screenX: number; screenY: number;
    tileX: number; tileY: number;
    canMove: boolean; canSearch: boolean; canPowerSearch: boolean;
  } | null>(null);
  const [walletDisconnected, setWalletDisconnected] = useState(false);
  const [roundBanner, setRoundBanner] = useState<{ text: string; color: string; fading: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [gameOverCountdown, setGameOverCountdown] = useState<number | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const hadAddressRef = useRef(false);
  const gameServiceRef = useRef(new GameService());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevScoresRef = useRef<{ my: number; opp: number } | null>(null);

  // Detect wallet disconnect mid-game
  useEffect(() => {
    if (address) {
      hadAddressRef.current = true;
      setWalletDisconnected(false);
    } else if (hadAddressRef.current) {
      setWalletDisconnected(true);
      setStatus('Wallet disconnected. Please reconnect to continue playing.');
    }
  }, [address]);

  const walletSignTransaction = useCallback(async (xdr: string) => {
    if (!signTransaction || !address) throw new Error('Wallet not connected');
    const signed = await signTransaction(xdr);
    return {
      signedTxXdr: signed.signedTxXdr,
      signerAddress: signed.signerAddress ?? address,
    };
  }, [signTransaction, address]);

  // Poll game state
  const pollGame = useCallback(async () => {
    if (!address) return;
    try {
      const client = createZkHuntClient();
      client.options.publicKey = address;
      const tx = await client.get_game({ session_id: sessionId });
      const result = tx.result;
      const gameData = result?.isOk?.() ? result.unwrap() as Game : undefined;

      if (gameData) {
        setGame(gameData);
        if (gameData.phase === GamePhase.Ended) {
          // Delay the final result message so the round banner shows first
          setTimeout(() => {
            const myNum = (address === gameData.player1) ? 1 : 2;
            const oppNum = (address === gameData.player1) ? 2 : 1;
            if (!gameData.winner) {
              setStatus('Match ended in a draw!');
            } else if (gameData.winner === address) {
              setStatus(`P${myNum} wins the match!`);
            } else {
              setStatus(`P${oppNum} wins the match!`);
            }
          }, 3200);
        } else {
          setStatus('');
        }
      }
    } catch (err: any) {
      console.error('[pollGame] Error:', err);
      setStatus(`Poll error: ${err.message}`);
    }
  }, [sessionId, address]);

  useEffect(() => {
    pollGame();
    pollingRef.current = setInterval(pollGame, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pollGame]);

  // Track round and phase to detect transitions and show banner
  const lastRoundRef = useRef<number>(0);
  const lastPhaseRef = useRef<number | null>(null);

  useEffect(() => {
    if (!game) return;

    const roundChanged = game.round !== lastRoundRef.current && lastRoundRef.current > 0;
    const justEnded = game.phase === GamePhase.Ended && lastPhaseRef.current !== null && lastPhaseRef.current !== GamePhase.Ended;

    // Detect round change OR game ending (final round doesn't increment round number)
    if (roundChanged || justEnded) {
      const isPlayer1 = address === game.player1;
      const myScore = isPlayer1 ? game.player1_score : game.player2_score;
      const oppScore = isPlayer1 ? game.player2_score : game.player1_score;
      const prev = prevScoresRef.current;

      if (prev) {
        const iScored = myScore > prev.my;
        const oppScored = oppScore > prev.opp;
        // On round change roles swapped, so invert. On game end roles stay the same.
        const wasHunter = roundChanged ? !isHunter : isHunter;
        const myNum = (address === game.player1) ? 1 : 2;
        const oppNum = (address === game.player1) ? 2 : 1;
        let text: string;
        let color: string;
        if (iScored) {
          text = wasHunter ? `P${myNum} caught the prey! P${myNum} scored.` : `P${myNum} survived! P${myNum} scored.`;
          color = 'var(--color-prey)';
        } else if (oppScored) {
          text = wasHunter ? `Prey escaped! P${oppNum} scored.` : `P${myNum} was caught! P${oppNum} scored.`;
          color = 'var(--color-hunter)';
        } else {
          text = 'Round over — No score';
          color = 'var(--color-searched)';
        }
        setRoundBanner({ text, color, fading: false });
        setTimeout(() => setRoundBanner((b) => b ? { ...b, fading: true } : null), 3000);
        setTimeout(() => setRoundBanner(null), 3600);
      }
    }

    lastPhaseRef.current = game.phase;

    // Update score tracking
    if (game) {
      const isPlayer1 = address === game.player1;
      prevScoresRef.current = {
        my: isPlayer1 ? game.player1_score : game.player2_score,
        opp: isPlayer1 ? game.player2_score : game.player1_score,
      };
    }

    if (game.round !== lastRoundRef.current) {
      lastRoundRef.current = game.round;
      if (!isHunter) {
        const secret = { x: game.prey_x, y: game.prey_y, nonce: generateRandomNonce() };
        setPreySecret(secret);
      } else {
        setPreySecretRaw(null);
        clearPreySecret(sessionId);
      }
      return;
    }
    if (!isHunter && !preySecret) {
      const saved = loadPreySecret(sessionId);
      if (saved) {
        setPreySecret(saved);
      } else {
        const secret = { x: game.prey_x, y: game.prey_y, nonce: generateRandomNonce() };
        setPreySecret(secret);
        savePreySecret(sessionId, secret);
      }
    }
  }, [isHunter, game, preySecret, sessionId]);

  useEffect(() => {
    if (game?.phase === GamePhase.Ended) {
      clearPreySecret(sessionId);
      // Start 8-second countdown then return to lobby
      setGameOverCountdown(8);
    }
  }, [game?.phase, sessionId]);

  // Countdown timer: tick every second, then call onBack
  useEffect(() => {
    if (gameOverCountdown === null) return;
    if (gameOverCountdown <= 0) { onBack(); return; }
    const t = setTimeout(() => setGameOverCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [gameOverCountdown, onBack]);

  // Auto-respond to search when prey enters SearchPending phase
  const autoRespondTriggered = useRef(false);
  useEffect(() => {
    if (!game || isHunter || game.phase !== GamePhase.SearchPending || !preySecret || isActing) {
      autoRespondTriggered.current = false;
      return;
    }
    if (autoRespondTriggered.current) return;
    autoRespondTriggered.current = true;
    void handleRespondSearch();
  }, [game?.phase, isHunter, preySecret, isActing]);

  // Auto-pass turn when prey is frozen
  const autoPassFrozenTriggered = useRef(false);
  useEffect(() => {
    if (!game || isHunter || game.phase !== GamePhase.PreyTurn || !game.prey_is_frozen || isActing) {
      autoPassFrozenTriggered.current = false;
      return;
    }
    if (autoPassFrozenTriggered.current) return;
    autoPassFrozenTriggered.current = true;
    void handlePassFrozen();
  }, [game?.phase, game?.prey_is_frozen, isHunter, isActing]);

  const isMyTurn = game && !walletDisconnected && (
    (game.phase === GamePhase.HunterTurn && isHunter) ||
    (game.phase === GamePhase.PreyTurn && !isHunter) ||
    (game.phase === GamePhase.SearchPending && !isHunter)
  );

  const handleTileClick = async (x: number, y: number) => {
    if (!address || !game || !isMyTurn || isActing) return;

    const client = createZkHuntClient();
    client.options.publicKey = address;

    if (isHunter && game.phase === GamePhase.HunterTurn) {
      const hunterPos = { x: game.hunter_x, y: game.hunter_y };
      const targetPos = { x, y };

      if (!isAdjacent(hunterPos, targetPos) || !isInBounds(x, y)) {
        setStatus('Invalid move: must be adjacent');
        return;
      }

      setIsActing(true);
      setStatus('Moving hunter...');
      try {
        const tx = await client.hunter_move({ session_id: sessionId, x, y });
        await tx.signAndSend({ signTransaction: walletSignTransaction });
        setStatus('');
        await pollGame();
      } catch (err: any) {
        setStatus(`Error: ${err.message}`);
      } finally {
        setIsActing(false);
      }
      return;
    }

    if (!isHunter && game.phase === GamePhase.PreyTurn && preySecret) {
      const preyPos = { x: preySecret.x, y: preySecret.y };
      const targetPos = { x, y };
      const dist = Math.abs(x - preyPos.x) + Math.abs(y - preyPos.y);

      if (dist === 0 || !isInBounds(x, y)) {
        setStatus('Invalid move');
        return;
      }

      // Validate: adjacent move or dash (distance 2, plains-only, dashes available)
      const isDash = dist === 2 && isPlains(currentMap, x, y) && !game.prey_is_hidden && game.prey_dash_remaining > 0;
      const isAdjacentMove = dist === 1;

      if (!isDash && !isAdjacentMove) {
        setStatus('Invalid move: too far');
        return;
      }

      setIsActing(true);
      const mapId = game.map_index;

      try {
        if (isDash) {
          setStatus('Dashing...');
          const tx = await client.prey_dash_public({ session_id: sessionId, x, y });
          await tx.signAndSend({ signTransaction: walletSignTransaction });
          const newNonce = generateRandomNonce();
          setPreySecret({ x, y, nonce: newNonce });
        } else if (game.prey_is_hidden) {
          if (isJungle(currentMap, x, y)) {
            setStatus('Generating ZK proof for jungle move (30-60s)...');
            const newNonce = generateRandomNonce();
            const proofResult = await gameServiceRef.current.generateJungleMoveProof(
              preySecret.x, preySecret.y, preySecret.nonce,
              x, y, newNonce, mapId,
            );
            const tx = await client.prey_move_jungle({
              session_id: sessionId,
              new_commitment: Buffer.from(proofResult.publicInputs.slice(32, 64)),
              proof: Buffer.from(proofResult.proofBlob),
            });
            await tx.signAndSend({ signTransaction: walletSignTransaction });
            setPreySecret({ x, y, nonce: newNonce });
          } else {
            setStatus('Exiting jungle...');
            const tx = await client.prey_exit_jungle({ session_id: sessionId, x, y });
            await tx.signAndSend({ signTransaction: walletSignTransaction });
            const newNonce = generateRandomNonce();
            setPreySecret({ x, y, nonce: newNonce });
          }
        } else {
          if (isJungle(currentMap, x, y)) {
            setStatus('Generating ZK proof to enter jungle (30-60s)...');
            const newNonce = generateRandomNonce();
            const proofResult = await gameServiceRef.current.generateJungleMoveProof(
              preySecret.x, preySecret.y, preySecret.nonce,
              x, y, newNonce, mapId,
            );
            const tx = await client.prey_enter_jungle({
              session_id: sessionId,
              new_commitment: Buffer.from(proofResult.publicInputs.slice(32, 64)),
              proof: Buffer.from(proofResult.proofBlob),
            });
            await tx.signAndSend({ signTransaction: walletSignTransaction });
            setPreySecret({ x, y, nonce: newNonce });
          } else {
            setStatus('Moving on plains...');
            const tx = await client.prey_move_public({ session_id: sessionId, x, y });
            await tx.signAndSend({ signTransaction: walletSignTransaction });
            const newNonce = generateRandomNonce();
            setPreySecret({ x, y, nonce: newNonce });
          }
        }
        setStatus('');
        await pollGame();
      } catch (err: any) {
        setStatus(`Error: ${err.message}`);
      } finally {
        setIsActing(false);
      }
    }
  };

  const handleSearch = async (x: number, y: number) => {
    if (!address || !game || !isHunter || game.phase !== GamePhase.HunterTurn || isActing) return;
    const client = createZkHuntClient();
    client.options.publicKey = address;
    setIsActing(true);
    setStatus('Searching tile...');
    try {
      const tx = await client.hunter_search({ session_id: sessionId, x, y });
      await tx.signAndSend({ signTransaction: walletSignTransaction });
      setStatus('Search sent! Waiting for prey response...');
      await pollGame();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsActing(false);
    }
  };

  const handlePowerSearch = async () => {
    if (!address || !game || !isHunter || game.phase !== GamePhase.HunterTurn || isActing) return;
    const client = createZkHuntClient();
    client.options.publicKey = address;
    setIsActing(true);
    setStatus('Power searching all adjacent jungle tiles...');
    try {
      const tx = await client.hunter_power_search({ session_id: sessionId });
      await tx.signAndSend({ signTransaction: walletSignTransaction });
      setStatus('Power search sent! Waiting for prey responses...');
      await pollGame();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsActing(false);
    }
  };

  const handleEMP = async () => {
    if (!address || !game || !isHunter || game.phase !== GamePhase.HunterTurn || isActing) return;
    const client = createZkHuntClient();
    client.options.publicKey = address;
    setIsActing(true);
    setStatus('Firing EMP...');
    try {
      const tx = await client.hunter_emp({ session_id: sessionId });
      await tx.signAndSend({ signTransaction: walletSignTransaction });
      setStatus('EMP fired! Prey is frozen for 1 turn.');
      await pollGame();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsActing(false);
    }
  };

  const handlePassFrozen = async () => {
    if (!address || !game || isHunter || game.phase !== GamePhase.PreyTurn || isActing) return;
    const client = createZkHuntClient();
    client.options.publicKey = address;
    setIsActing(true);
    setStatus('You are frozen! Skipping turn...');
    try {
      const tx = await client.prey_pass_frozen({ session_id: sessionId });
      await tx.signAndSend({ signTransaction: walletSignTransaction });
      setStatus('');
      await pollGame();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsActing(false);
    }
  };

  const handleRespondSearch = async () => {
    if (!address || !game || isHunter || game.phase !== GamePhase.SearchPending || !preySecret || isActing) return;
    const client = createZkHuntClient();
    client.options.publicKey = address;
    setIsActing(true);
    const tileCount = game.searched_tiles_x.length;
    setStatus(`Generating search response proof for ${tileCount} tile${tileCount > 1 ? 's' : ''} (30-60s)...`);
    try {
      const proofResult = await gameServiceRef.current.generateSearchResponseProof(
        preySecret.x, preySecret.y, preySecret.nonce,
        game.searched_tiles_x, game.searched_tiles_y,
      );
      setStatus('Submitting search response...');
      const tx = await client.respond_search({
        session_id: sessionId,
        proof: Buffer.from(proofResult.proofBlob),
      });
      await tx.signAndSend({ signTransaction: walletSignTransaction });
      setStatus('Search response sent!');
      await pollGame();
    } catch (err: any) {
      if (err.message?.includes('prey is at a searched position')) {
        setStatus('Caught! Conceding...');
        try {
          const tx = await client.respond_search({
            session_id: sessionId,
            proof: Buffer.from([]),
          });
          await tx.signAndSend({ signTransaction: walletSignTransaction });
          setStatus('Caught! Round goes to the hunter.');
          await pollGame();
        } catch (concErr: any) {
          setStatus(`Error conceding: ${concErr.message}`);
        }
      } else {
        setStatus(`Error: ${err.message}`);
      }
    } finally {
      setIsActing(false);
    }
  };

  const handleClaimCatch = async () => {
    if (!address || !game || !isHunter || game.phase !== GamePhase.SearchPending || isActing) return;
    const client = createZkHuntClient();
    client.options.publicKey = address;
    setIsActing(true);
    setStatus('Claiming catch...');
    try {
      const tx = await client.claim_catch({ session_id: sessionId });
      await tx.signAndSend({ signTransaction: walletSignTransaction });
      setStatus('Caught the prey!');
      await pollGame();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsActing(false);
    }
  };

  // Valid moves
  const validMoves = useMemo(() => {
    const moves = new Set<string>();
    if (!game || !isMyTurn) return moves;

    if (isHunter && game.phase === GamePhase.HunterTurn) {
      const pos = { x: game.hunter_x, y: game.hunter_y };
      const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1], [0, 0]];
      for (const [dx, dy] of offsets) {
        const nx = pos.x + dx;
        const ny = pos.y + dy;
        if (isInBounds(nx, ny)) moves.add(`${nx},${ny}`);
      }
    } else if (!isHunter && game.phase === GamePhase.PreyTurn && preySecret && !game.prey_is_frozen) {
      const pos = { x: preySecret.x, y: preySecret.y };
      // Adjacent moves (distance 1)
      const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1], [0, 0]];
      for (const [dx, dy] of offsets) {
        const nx = pos.x + dx;
        const ny = pos.y + dy;
        if (isInBounds(nx, ny)) moves.add(`${nx},${ny}`);
      }
      // Dash moves (distance 2, plains only, prey not hidden, dashes available)
      if (!game.prey_is_hidden && game.prey_dash_remaining > 0) {
        for (let dx = -2; dx <= 2; dx++) {
          for (let dy = -2; dy <= 2; dy++) {
            if (Math.abs(dx) + Math.abs(dy) === 2) {
              const nx = pos.x + dx;
              const ny = pos.y + dy;
              if (isInBounds(nx, ny) && isPlains(currentMap, nx, ny)) {
                moves.add(`${nx},${ny}`);
              }
            }
          }
        }
      }
    }
    return moves;
  }, [game, isMyTurn, isHunter, preySecret, currentMap]);

  // Searched tiles for effects
  const searchedTiles = useMemo(() => {
    if (!game) return [];
    return game.searched_tiles_x.map((sx: number, i: number) => ({
      x: sx,
      y: game.searched_tiles_y[i],
    }));
  }, [game?.searched_tiles_x, game?.searched_tiles_y]);

  // Board positions
  const hunterPos = game ? { x: game.hunter_x, y: game.hunter_y } : null;
  const preyPos = game ? { x: game.prey_x, y: game.prey_y } : null;
  const preyGhostPos =
    !isHunter && preySecret && game?.prey_is_hidden
      ? { x: preySecret.x, y: preySecret.y }
      : null;
  // Show "?" at last known prey position for hunter when prey is hidden
  const lastKnownPreyPos =
    isHunter && game?.prey_is_hidden
      ? { x: game.prey_x, y: game.prey_y }
      : null;

  const handleBoardTileClick = (x: number, y: number, screenX: number, screenY: number) => {
    if (isActing) return;
    // Hunter clicking a jungle tile → show context menu
    if (isHunter && game?.phase === GamePhase.HunterTurn && isJungle(currentMap, x, y)) {
      const hunterPos = { x: game.hunter_x, y: game.hunter_y };
      const canMove = validMoves.has(`${x},${y}`);
      // canSearch: tile is within Chebyshev-1 of hunter (diagonal included)
      const canSearch = !!game.prey_is_hidden && canHunterSearch(hunterPos, { x, y });
      const canPowerSearch = !!game.prey_is_hidden;
      if (canMove && !canSearch) {
        // No menu needed — just move
        handleTileClick(x, y);
        return;
      }
      if (canMove || canSearch) {
        setSelectedTile({ x, y });
        setContextMenu({ screenX, screenY, tileX: x, tileY: y, canMove, canSearch, canPowerSearch });
        return;
      }
    }
    // Normal tile click (plains move, prey move, etc.)
    setContextMenu(null);
    setSelectedTile(null);
    if (validMoves.has(`${x},${y}`)) {
      handleTileClick(x, y);
    }
  };

  const handleBoardRightClick = (_x: number, _y: number) => {
    // Right-click dismisses any open context menu
    setContextMenu(null);
    setSelectedTile(null);
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top-right controls */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '12px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <WalletButton />
        <button
          onClick={() => setShowHowToPlay(true)}
          style={{
            background: 'rgba(100, 210, 255, 0.08)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(100, 210, 255, 0.3)',
            borderRadius: '24px',
            color: 'var(--color-prey)',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.07em',
            padding: '7px 16px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          HOW TO PLAY
        </button>
        <button
          onClick={onBack}
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid var(--glass-border)',
            borderRadius: '24px',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            padding: '7px 18px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontWeight: 500,
          }}
        >
          Leave
        </button>
      </div>

      {/* Round end banner */}
      {roundBanner && (
        <div
          style={{
            position: 'absolute',
            top: '40%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            padding: '14px 32px',
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${roundBanner.color}`,
            borderRadius: '16px',
            color: roundBanner.color,
            fontSize: '18px',
            fontWeight: 700,
            textAlign: 'center',
            pointerEvents: 'none',
            animation: roundBanner.fading
              ? 'round-banner-out 0.6s ease-out forwards'
              : 'round-banner-in 0.4s ease-out forwards',
          }}
        >
          {roundBanner.text}
        </div>
      )}

      {/* Wallet disconnected warning */}
      {walletDisconnected && (
        <div
          style={{
            position: 'absolute',
            top: '40px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            padding: '8px 16px',
            background: 'rgba(255, 105, 97, 0.12)',
            border: '1px solid rgba(255, 105, 97, 0.25)',
            borderRadius: '20px',
            color: 'var(--color-hunter)',
            fontSize: '12px',
            fontWeight: 600,
            backdropFilter: 'blur(10px)',
          }}
        >
          Wallet disconnected
        </div>
      )}

      {/* Status message — top center */}
      {status && (
        <div
          style={{
            position: 'absolute',
            top: '14px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 15,
            padding: '8px 20px',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(var(--glass-blur))',
            WebkitBackdropFilter: 'blur(var(--glass-blur))',
            border: '1px solid var(--glass-border)',
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: '80%',
          }}
        >
          {isActing && <span className="spinner" />}
          <span
            style={{
              color: status.startsWith('Error') ? 'var(--color-hunter)' : 'var(--text-secondary)',
              fontSize: '14px',
              whiteSpace: 'nowrap',
            }}
          >
            {status}
          </span>
        </div>
      )}

      {/* HUD */}
      <GameHUD game={game} playerAddress={address ?? null} isHunter={isHunter} />

      {/* 3D Board */}
      <Board3D
        map={currentMap}
        hunterPos={hunterPos}
        preyPos={preyPos}
        preyVisible={!game?.prey_is_hidden}
        preyFrozen={!!game?.prey_is_frozen}
        preyGhostPos={preyGhostPos}
        lastKnownPreyPos={lastKnownPreyPos}
        searchedTiles={searchedTiles}
        validMoves={validMoves}
        selectedTile={selectedTile}
        onTileClick={handleBoardTileClick}
        onTileRightClick={handleBoardRightClick}
      />

      {/* Controls */}
      <GameControls
        game={game}
        isHunter={isHunter}
        isActing={isActing}
        onPowerSearch={handlePowerSearch}
        onEMP={handleEMP}
        onRespondSearch={handleRespondSearch}
        onClaimCatch={handleClaimCatch}
      />

      {/* Waiting for player 2 modal */}
      {game?.phase === GamePhase.WaitingForPlayer2 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        >
          <div
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
              border: '1px solid var(--glass-border)',
              borderRadius: '24px',
              padding: '40px 48px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
              maxWidth: '400px',
              width: '90%',
              textAlign: 'center',
            }}
          >
            <span className="spinner" style={{ width: '32px', height: '32px', borderWidth: '3px' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Waiting for another player
              </h2>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
                Share this ID so your opponent can join
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '20px 32px',
                background: 'rgba(100, 210, 255, 0.06)',
                border: '1px solid rgba(100, 210, 255, 0.2)',
                borderRadius: '16px',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Session ID
              </span>
              <span
                style={{
                  fontSize: '72px',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  color: 'var(--color-prey)',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                {sessionId}
              </span>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(String(sessionId));
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              style={{
                background: copied ? 'rgba(100, 210, 255, 0.12)' : 'transparent',
                border: `1px solid ${copied ? 'rgba(100, 210, 255, 0.35)' : 'var(--glass-border)'}`,
                borderRadius: '24px',
                color: copied ? 'var(--color-prey)' : 'var(--text-secondary)',
                fontSize: '14px',
                padding: '10px 28px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: 600,
                transition: 'all 0.2s',
                width: '100%',
              }}
            >
              {copied ? '✓ Copied' : 'Copy ID'}
            </button>
          </div>
        </div>
      )}

      {/* How to Play modal */}
      {showHowToPlay && <HowToPlay onClose={() => setShowHowToPlay(false)} />}

      {/* Game over overlay */}
      {game?.phase === GamePhase.Ended && gameOverCountdown !== null && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <div
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
              border: '1px solid var(--glass-border)',
              borderRadius: '24px',
              padding: '48px 56px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
              textAlign: 'center',
              minWidth: '320px',
            }}
          >
            {/* Result */}
            <div style={{ fontSize: '42px', fontWeight: 800, letterSpacing: '-0.02em', color:
              !game.winner ? 'var(--color-searched)'
              : game.winner === address ? 'var(--color-prey)'
              : 'var(--color-hunter)',
            }}>
              {!game.winner ? 'Draw' : game.winner === address ? 'You Win!' : 'You Lose'}
            </div>

            {/* Final score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '22px', fontWeight: 700 }}>
              <span style={{ color: address === game.player1 ? 'var(--color-prey)' : 'var(--text-secondary)' }}>
                {game.player1_score}
              </span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '16px' }}>—</span>
              <span style={{ color: address === game.player2 ? 'var(--color-prey)' : 'var(--text-secondary)' }}>
                {game.player2_score}
              </span>
            </div>

            {/* Countdown */}
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
              Returning to lobby in {gameOverCountdown}s...
            </p>

            <button
              onClick={onBack}
              style={{
                background: 'var(--btn-primary-bg)',
                border: '1px solid var(--btn-primary-border)',
                borderRadius: '24px',
                color: 'var(--btn-primary-text)',
                fontSize: '14px',
                fontWeight: 600,
                padding: '10px 28px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Back to Lobby
            </button>
          </div>
        </div>
      )}

      {/* Tile context menu */}
      {contextMenu && (
        <TileContextMenu
          screenX={contextMenu.screenX}
          screenY={contextMenu.screenY}
          canMove={contextMenu.canMove}
          canSearch={contextMenu.canSearch}
          onMove={() => {
            handleTileClick(contextMenu.tileX, contextMenu.tileY);
            setSelectedTile(null);
          }}
          onSearch={() => {
            handleSearch(contextMenu.tileX, contextMenu.tileY);
            setSelectedTile(null);
          }}
          onClose={() => {
            setContextMenu(null);
            setSelectedTile(null);
          }}
        />
      )}
    </div>
  );
};
