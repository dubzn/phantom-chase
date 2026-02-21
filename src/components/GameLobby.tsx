import React, { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { createZkHuntClient } from '../contracts/zk_hunt';
import { GlassPanel } from './ui/GlassPanel';
import { GlassButton } from './ui/GlassButton';
import { WalletButton } from './WalletButton';
import { LobbyBackground } from './board3d/LobbyBackground';

interface GameLobbyProps {
  onGameStart: (sessionId: number, isHunter: boolean) => void;
}

export const GameLobby: React.FC<GameLobbyProps> = ({ onGameStart }) => {
  const { address, signTransaction } = useWallet();
  const [joinSessionId, setJoinSessionId] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const walletSignTransaction = async (xdr: string) => {
    if (!signTransaction || !address) throw new Error('Wallet not connected');
    const signed = await signTransaction(xdr);
    return {
      signedTxXdr: signed.signedTxXdr,
      signerAddress: signed.signerAddress ?? address,
    };
  };

  const handleCreateGame = async () => {
    if (!address) {
      setStatus('Connect your wallet first');
      return;
    }
    setIsLoading(true);
    setStatus('Creating game...');
    try {
      const client = createZkHuntClient();
      client.options.publicKey = address;
      const tx = await client.create_game({ hunter: address });
      const result = await tx.signAndSend({ signTransaction: walletSignTransaction });
      const sessionId = result.result;
      setStatus(`Game created! Session ID: ${sessionId}`);
      onGameStart(sessionId, true);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinGame = async () => {
    if (!address) {
      setStatus('Connect your wallet first');
      return;
    }
    const id = parseInt(joinSessionId);
    if (isNaN(id) || id <= 0) {
      setStatus('Enter a valid session ID');
      return;
    }
    setIsLoading(true);
    setStatus('Joining game...');
    try {
      const client = createZkHuntClient();
      client.options.publicKey = address;
      const tx = await client.join_game({ session_id: id, prey: address });
      await tx.signAndSend({ signTransaction: walletSignTransaction });
      setStatus(`Joined game ${id}!`);
      onGameStart(id, false);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Grid + particles background */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <LobbyBackground />
      </div>

      {/* Wallet button — top right */}
      <div style={{ position: 'absolute', top: '16px', right: '20px', zIndex: 10 }}>
        <WalletButton />
      </div>

      {/* Lobby UI overlay */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          padding: '20px',
        }}
      >
        {/* Logo */}
        <img
          src="/logo.png"
          alt="Phantom Chase"
          style={{
            maxWidth: '500px',
            width: '100%',
            height: 'auto',
            filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.6))',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />

        {/* Unified card */}
        <GlassPanel
          style={{ maxWidth: '420px', width: '100%' }}
          padding="32px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Create Game button */}
            <GlassButton
              variant="primary"
              size="md"
              onClick={handleCreateGame}
              disabled={!address || isLoading}
              style={{ width: '100%' }}
            >
              {isLoading && !joinSessionId ? 'Creating...' : 'Create Game'}
            </GlassButton>

            {/* "or" divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--glass-border)' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--glass-border)' }} />
            </div>

            {/* Join Game row */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="number"
                placeholder="Session ID"
                value={joinSessionId}
                onChange={(e) => setJoinSessionId(e.target.value)}
                className="glass-input"
                style={{ flex: 1, minWidth: 0 }}
              />
              <GlassButton
                variant="secondary"
                size="md"
                onClick={handleJoinGame}
                disabled={!address || isLoading || !joinSessionId}
              >
                {isLoading && joinSessionId ? 'Joining...' : 'Join'}
              </GlassButton>
            </div>
          </div>
        </GlassPanel>

        {/* Status */}
        {status && (
          <GlassPanel
            style={{
              maxWidth: '420px',
              width: '100%',
              border: status.startsWith('Error')
                ? '1px solid rgba(255, 105, 97, 0.3)'
                : '1px solid rgba(100, 210, 255, 0.3)',
            }}
            padding="12px 18px"
          >
            <span
              style={{
                color: status.startsWith('Error') ? 'var(--color-hunter)' : 'var(--color-prey)',
                fontSize: '13px',
                fontFamily: 'monospace',
              }}
            >
              {status}
            </span>
          </GlassPanel>
        )}
      </div>
    </div>
  );
};
