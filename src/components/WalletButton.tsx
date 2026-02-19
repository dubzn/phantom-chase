import { useState } from 'react';
import { GlassButton } from './ui/GlassButton';
import { GlassModal } from './ui/GlassModal';
import { useWallet } from '../hooks/useWallet';
import { useWalletBalance } from '../hooks/useWalletBalance';
import { getFriendbotUrl } from '../util/friendbot';
import { getSelectedNetwork } from '../contracts/util';

const truncateAddress = (addr: string) =>
  `${addr.slice(0, 4)}...${addr.slice(-4)}`;

export const WalletButton = () => {
  const [showModal, setShowModal] = useState(false);
  const [funding, setFunding] = useState(false);
  const { address, isPending } = useWallet();
  const { xlm, isFunded, updateBalance, ...balance } = useWalletBalance();

  const canFund = !isFunded && ['LOCAL', 'TESTNET', 'FUTURENET', 'NOIR'].includes(getSelectedNetwork());

  const handleFund = async () => {
    if (!address) return;
    setFunding(true);
    try {
      const res = await fetch(getFriendbotUrl(address));
      if (res.ok) {
        await updateBalance();
      }
    } finally {
      setFunding(false);
    }
  };

  if (isPending || !address) {
    return (
      <GlassButton variant="secondary" size="sm" disabled>
        Loading...
      </GlassButton>
    );
  }

  return (
    <>
      <GlassButton
        variant="secondary"
        size="sm"
        onClick={() => setShowModal(true)}
        style={{ opacity: balance.isLoading ? 0.6 : 1 }}
      >
        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{xlm} XLM</span>
        <span style={{ color: 'var(--color-prey)' }}>{truncateAddress(address)}</span>
      </GlassButton>

      <GlassModal visible={showModal} onClose={() => setShowModal(false)}>
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          Dev Wallet
        </h3>
        <p
          style={{
            margin: '0 0 20px 0',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            wordBreak: 'break-all',
            fontFamily: 'monospace',
            lineHeight: 1.5,
          }}
        >
          {address}
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          {canFund && (
            <GlassButton
              variant="primary"
              size="sm"
              disabled={funding}
              onClick={() => void handleFund()}
            >
              {funding ? 'Funding...' : 'Fund Account'}
            </GlassButton>
          )}
          <GlassButton variant="ghost" size="sm" onClick={() => setShowModal(false)}>
            Close
          </GlassButton>
        </div>
      </GlassModal>
    </>
  );
};
