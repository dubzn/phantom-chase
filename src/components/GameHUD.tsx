import React from 'react';
import { Game, GamePhase } from '../contracts/zk_hunt';
import { MAX_TURNS } from '../services/GameService';

interface GameHUDProps {
  game: Game | null;
  playerAddress: string | null;
  isHunter: boolean;
}

const divider: React.CSSProperties = {
  width: 1,
  height: 20,
  background: 'rgba(255,255,255,0.1)',
  flexShrink: 0,
};

const barStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  padding: '11px 22px',
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  border: '1px solid var(--glass-border)',
  borderRadius: '24px',
  fontSize: '14px',
  whiteSpace: 'nowrap',
};

const pulseKeyframes = `
@keyframes hud-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
`;

export const GameHUD: React.FC<GameHUDProps> = ({ game, playerAddress, isHunter }) => {
  if (!game) return null;

  const isMyTurn =
    (game.phase === GamePhase.HunterTurn && isHunter) ||
    (game.phase === GamePhase.PreyTurn && !isHunter) ||
    (game.phase === GamePhase.SearchPending && !isHunter);

  const isPlayer1 = playerAddress === game.player1;
  const myNum = isPlayer1 ? 1 : 2;
  const oppNum = isPlayer1 ? 2 : 1;
  const myScore = isPlayer1 ? game.player1_score : game.player2_score;
  const oppScore = isPlayer1 ? game.player2_score : game.player1_score;
  const role = isHunter ? 'Hunter' : 'Prey';

  const winnerText =
    game.phase === GamePhase.Ended
      ? game.winner
        ? game.winner === playerAddress
          ? `P${myNum} Wins!`
          : `P${oppNum} Wins!`
        : 'Draw!'
      : null;

  const winnerIsMe = game.winner === playerAddress;

  let turnLabel: string;
  if (game.phase === GamePhase.Ended) {
    turnLabel = 'Game Over';
  } else if (game.phase === GamePhase.WaitingForPlayer2) {
    turnLabel = 'Waiting';
  } else if (game.phase === GamePhase.SearchPending) {
    turnLabel = isHunter ? 'Searching...' : 'Responding...';
  } else {
    turnLabel = isMyTurn ? 'Your Turn' : 'Opponent Turn';
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        maxWidth: '580px',
      }}
    >
      {/* Inject pulse animation */}
      <style>{pulseKeyframes}</style>

      {/* Winner overlay */}
      {winnerText && (
        <div
          style={{
            ...barStyle,
            padding: '13px 30px',
            fontSize: '18px',
            fontWeight: 700,
            color: !game.winner
              ? 'var(--color-searched)'
              : winnerIsMe
                ? 'var(--color-prey)'
                : 'var(--color-hunter)',
            background: !game.winner
              ? 'rgba(255, 214, 10, 0.12)'
              : winnerIsMe
                ? 'rgba(100, 210, 255, 0.12)'
                : 'rgba(255, 105, 97, 0.12)',
          }}
        >
          {winnerText}
        </div>
      )}

      {/* Top row: Player | Role | Turn | Round | Move */}
      <div style={barStyle as React.CSSProperties}>
        {/* Player + Role pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontWeight: 700,
            color: 'var(--text-primary)',
            fontSize: '13px',
          }}>
            P{myNum}
          </span>
          <span style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}>
            /
          </span>
          <span style={{
            fontWeight: 600,
            color: isHunter ? 'var(--color-hunter)' : 'var(--color-prey)',
            fontSize: '13px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            {role}
          </span>
        </div>

        <div style={divider} />

        {/* Turn indicator */}
        <span
          style={{
            color: isMyTurn ? 'var(--color-searched)' : 'var(--text-secondary)',
            fontWeight: isMyTurn ? 600 : 400,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            animation: isMyTurn ? 'hud-pulse 1.5s ease-in-out infinite' : 'none',
          }}
        >
          {turnLabel}
        </span>

        <div style={divider} />

        {/* Round */}
        <span style={{ color: 'var(--text-secondary)' }}>
          Round {game.round}/{game.total_rounds}
        </span>

        <div style={divider} />

        {/* Turn */}
        <span style={{ color: 'var(--text-secondary)' }}>
          Turn {game.turn_number}/{MAX_TURNS}
        </span>
      </div>

      {/* Bottom row: Score | Power searches | Prey hidden */}
      <div style={barStyle as React.CSSProperties}>
        {/* Score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '12px' }}>P{myNum}</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{myScore}</span>
          <span style={{ color: 'var(--text-muted)' }}>-</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{oppScore}</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '12px' }}>P{oppNum}</span>
        </div>

        {/* Max Search counter (hunter only) */}
        {isHunter && <div style={divider} />}
        {isHunter && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Max</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {Array.from({ length: 2 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background:
                      i < game.power_searches_remaining
                        ? 'var(--color-prey)'
                        : 'rgba(255,255,255,0.1)',
                    display: 'inline-block',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* EMP counter (hunter) */}
        {isHunter && (
          <>
            <div style={divider} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>EMP</span>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background:
                    game.emp_uses_remaining > 0
                      ? 'var(--color-hunter)'
                      : 'rgba(255,255,255,0.1)',
                  display: 'inline-block',
                }}
              />
            </div>
          </>
        )}

        {/* Dash counter (prey) */}
        {!isHunter && (
          <>
            <div style={divider} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Dash</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {Array.from({ length: 2 }, (_, i) => (
                  <span
                    key={i}
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background:
                        i < game.prey_dash_remaining
                          ? 'var(--color-prey)'
                          : 'rgba(255,255,255,0.1)',
                      display: 'inline-block',
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Frozen indicator (prey) */}
        {!isHunter && game.prey_is_frozen && (
          <>
            <div style={divider} />
            <span
              style={{
                color: 'var(--color-hunter)',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              FROZEN
            </span>
          </>
        )}

        {/* Prey hidden badge */}
        {game.prey_is_hidden && (
          <>
            <div style={divider} />
            <span
              style={{
                color: 'var(--color-searched)',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Hidden
            </span>
          </>
        )}
      </div>
    </div>
  );
};
