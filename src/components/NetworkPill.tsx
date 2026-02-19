import React from 'react';
import { useWallet } from '../hooks/useWallet';
import { stellarNetwork } from '../contracts/util';

const formatNetworkName = (name: string) => {
  if (name === 'STANDALONE') return 'Local';
  if (name === 'NOIR') return 'NOIR';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
};

const appNetwork = formatNetworkName(stellarNetwork);

const NetworkPill: React.FC = () => {
  const { network, address } = useWallet();

  const walletNetwork = formatNetworkName(network ?? '');
  const isNetworkMismatch = address ? walletNetwork !== appNetwork : false;

  let dotColor = '#2ED06E';
  let title = '';
  if (!address) {
    dotColor = 'rgba(255,255,255,0.3)';
    title = 'Connect your wallet using this network.';
  } else if (isNetworkMismatch) {
    dotColor = '#ff6961';
    title = `Wallet is on ${walletNetwork}, connect to ${appNetwork} instead.`;
  }

  return (
    <div
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '20px',
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        cursor: isNetworkMismatch ? 'help' : 'default',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dotColor,
          display: 'inline-block',
          boxShadow: 'none',
        }}
      />
      {appNetwork}
    </div>
  );
};

export { NetworkPill as default };
