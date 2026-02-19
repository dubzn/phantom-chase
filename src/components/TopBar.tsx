import React from 'react';
import { WalletButton } from './WalletButton';
import NetworkPill from './NetworkPill';
import NetworkSwitcher from './NetworkSwitcher';

export const TopBar: React.FC = () => (
  <header
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: 'var(--topbar-height)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      padding: '0 20px',
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(var(--glass-blur))',
      WebkitBackdropFilter: 'blur(var(--glass-blur))',
      borderBottom: '1px solid var(--glass-border)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <NetworkPill />
      <NetworkSwitcher />
      <WalletButton />
    </div>
  </header>
);
