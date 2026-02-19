import { useState } from 'react';
import { GlassButton } from './ui/GlassButton';
import { GlassModal } from './ui/GlassModal';
import storage from '../util/storage';
import { stellarNetwork } from '../contracts/util';

export type NetworkOption = {
  id: string;
  label: string;
  rpcUrl: string;
  horizonUrl: string;
  passphrase: string;
};

const NETWORKS: NetworkOption[] = [
  {
    id: 'LOCAL',
    label: 'Local',
    rpcUrl: 'http://localhost:8000/rpc',
    horizonUrl: 'http://localhost:8000',
    passphrase: 'Standalone Network ; February 2017',
  },
  {
    id: 'TESTNET',
    label: 'Testnet',
    rpcUrl: 'https://soroban-testnet.stellar.org:443',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    passphrase: 'Test SDF Network ; September 2015',
  },
  {
    id: 'FUTURENET',
    label: 'Futurenet',
    rpcUrl: 'https://rpc-futurenet.stellar.org:443',
    horizonUrl: 'https://horizon-futurenet.stellar.org',
    passphrase: 'Test SDF Future Network ; October 2022',
  },
  {
    id: 'PUBLIC',
    label: 'Mainnet',
    rpcUrl: 'https://soroban-rpc.mainnet.stellar.org:443',
    horizonUrl: 'https://horizon.stellar.org',
    passphrase: 'Public Global Stellar Network ; September 2015',
  },
  {
    id: 'NOIR',
    label: 'NOIR',
    rpcUrl: 'https://noir-local.stellar.buzz/soroban/rpc',
    horizonUrl: 'https://noir-local.stellar.buzz',
    passphrase: 'Standalone Network ; February 2017',
  },
];

export const NetworkSwitcher: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const currentNetwork = stellarNetwork;

  const handleNetworkSelect = (network: NetworkOption) => {
    storage.setItem('selectedNetwork', network.id);
    setShowModal(false);
    window.location.reload();
  };

  return (
    <>
      <GlassButton variant="ghost" size="sm" onClick={() => setShowModal(true)}>
        Network
      </GlassButton>
      <GlassModal visible={showModal} onClose={() => setShowModal(false)}>
        <h3
          style={{
            margin: '0 0 16px 0',
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          Select Network
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {NETWORKS.map((network) => (
            <GlassButton
              key={network.id}
              variant={currentNetwork === network.id ? 'primary' : 'secondary'}
              size="md"
              onClick={() => handleNetworkSelect(network)}
              style={{ width: '100%', justifyContent: 'flex-start' }}
            >
              {network.label}
            </GlassButton>
          ))}
        </div>
        <div style={{ marginTop: '16px', textAlign: 'right' }}>
          <GlassButton variant="ghost" size="sm" onClick={() => setShowModal(false)}>
            Cancel
          </GlassButton>
        </div>
      </GlassModal>
    </>
  );
};

export { NetworkSwitcher as default };
