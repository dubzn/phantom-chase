import React from 'react';
import { GlassPanel } from './ui/GlassPanel';
import { GlassButton } from './ui/GlassButton';
import { Game, GamePhase } from '../contracts/zk_hunt';

interface GameControlsProps {
  game: Game | null;
  isHunter: boolean;
  isActing: boolean;
  onPowerSearch: () => void;
  onRespondSearch: () => void;
  onClaimCatch: () => void;
}

export const GameControls: React.FC<GameControlsProps> = ({
  game,
  isHunter,
  isActing,
  onPowerSearch,
  onRespondSearch,
  onClaimCatch,
}) => {
  if (!game) return null;

  const hasActions =
    (isHunter && game.phase === GamePhase.HunterTurn && game.prey_is_hidden) ||
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
        <GlassButton
          variant="primary"
          size="sm"
          onClick={onPowerSearch}
          disabled={isActing || game.power_searches_remaining === 0}
        >
          Power Search ({game.power_searches_remaining})
        </GlassButton>
      )}


    </GlassPanel>
  );
};
