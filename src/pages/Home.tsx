import React, { useState } from 'react';
import { GameLobby } from '../components/GameLobby';
import { GameView } from '../components/GameView';

const Home: React.FC = () => {
  const [activeGame, setActiveGame] = useState<{
    sessionId: number;
    isHunter: boolean;
  } | null>(null);

  const handleGameStart = (sessionId: number, isHunter: boolean) => {
    setActiveGame({ sessionId, isHunter });
  };

  const handleBackToLobby = () => {
    setActiveGame(null);
  };

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      {activeGame ? (
        <GameView
          sessionId={activeGame.sessionId}
          isHunter={activeGame.isHunter}
          onBack={handleBackToLobby}
        />
      ) : (
        <GameLobby onGameStart={handleGameStart} />
      )}
    </div>
  );
};

export default Home;
