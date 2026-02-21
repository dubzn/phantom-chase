import React, { useState } from 'react';
import { GlassPanel } from './ui/GlassPanel';
import { GlassButton } from './ui/GlassButton';
import { Game, GamePhase } from '../contracts/zk_hunt';

interface GameControlsProps {
  game: Game | null;
  isHunter: boolean;
  isActing: boolean;
  onPowerSearch: () => void;
  onEMP: () => void;
  onRespondSearch: () => void;
  onClaimCatch: () => void;
}

const tooltipStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 'calc(100% + 10px)',
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(10, 12, 20, 0.92)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px',
  padding: '8px 12px',
  fontSize: '12px',
  lineHeight: '1.5',
  color: 'rgba(255,255,255,0.85)',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  zIndex: 20,
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  textAlign: 'center',
};

export const GameControls: React.FC<GameControlsProps> = ({
  game,
  isHunter,
  isActing,
  onPowerSearch,
  onEMP,
  onRespondSearch,
  onClaimCatch,
}) => {
  const [hoveredBtn, setHoveredBtn] = useState<'maxSearch' | 'emp' | null>(null);

  if (!game) return null;

  // EMP is available when prey is visible and hunter has uses (global range)
  const showEMP = isHunter && game.phase === GamePhase.HunterTurn && !game.prey_is_hidden && game.emp_uses_remaining > 0;

  const hasActions =
    (isHunter && game.phase === GamePhase.HunterTurn && (game.prey_is_hidden || showEMP)) ||
    (!isHunter && game.phase === GamePhase.SearchPending) ||
    (isHunter && game.phase === GamePhase.SearchPending);

  if (!hasActions) return null;

  return (
    <GlassPanel
      style={{
        position: 'absolute',
        bottom: '160px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        maxWidth: '90%',
      }}
      padding="10px 16px"
    >
      {isHunter && game.phase === GamePhase.HunterTurn && game.prey_is_hidden && (
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => setHoveredBtn('maxSearch')}
          onMouseLeave={() => setHoveredBtn(null)}
        >
          {hoveredBtn === 'maxSearch' && (
            <div style={tooltipStyle}>
              Reveals all adjacent jungle tiles<br />
              including diagonals at once.<br />
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px' }}>
                {game.power_searches_remaining} use{game.power_searches_remaining !== 1 ? 's' : ''} remaining
              </span>
            </div>
          )}
          <GlassButton
            variant="primary"
            size="sm"
            onClick={onPowerSearch}
            disabled={isActing || game.power_searches_remaining === 0}
          >
            Max Search ({game.power_searches_remaining})
          </GlassButton>
        </div>
      )}

      {showEMP && (
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => setHoveredBtn('emp')}
          onMouseLeave={() => setHoveredBtn(null)}
        >
          {hoveredBtn === 'emp' && (
            <div style={tooltipStyle}>
              <>Freezes the prey — you still move this turn.<br /><span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px' }}>Use EMP then walk onto their tile<br />to catch them in one action.</span></>
            </div>
          )}
          <GlassButton
            variant="primary"
            size="sm"
            onClick={onEMP}
            disabled={isActing}
          >
            EMP ({game.emp_uses_remaining})
          </GlassButton>
        </div>
      )}
    </GlassPanel>
  );
};
