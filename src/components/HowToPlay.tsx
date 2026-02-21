import React from 'react';

interface HowToPlayProps {
  onClose: () => void;
}

const Section: React.FC<{ title: string; color?: string; children: React.ReactNode }> = ({
  title, color = 'var(--text-primary)', children,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {title}
    </h3>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {children}
    </div>
  </div>
);

const Row: React.FC<{ label: string; desc: string; badge?: string; badgeColor?: string }> = ({
  label, desc, badge, badgeColor = 'var(--color-prey)',
}) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px' }}>
    <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', minWidth: '90px' }}>
      {label}
    </span>
    {badge && (
      <span style={{
        fontSize: '10px', fontWeight: 700, color: badgeColor,
        border: `1px solid ${badgeColor}`, borderRadius: '4px',
        padding: '1px 5px', whiteSpace: 'nowrap', opacity: 0.85,
      }}>
        {badge}
      </span>
    )}
    <span style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{desc}</span>
  </div>
);

export const HowToPlay: React.FC<HowToPlayProps> = ({ onClose }) => (
  <div
    style={{
      position: 'absolute', inset: 0, zIndex: 70,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    }}
    onClick={onClose}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: 'rgba(8, 10, 20, 0.95)',
        border: '1px solid var(--glass-border)',
        borderRadius: '24px',
        padding: '32px 36px',
        width: '520px',
        maxWidth: '92vw',
        maxHeight: '85vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
            How to Play
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            Phantom Chase — 2 players, 2 rounds each
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: '1px solid var(--glass-border)', borderRadius: '50%',
            color: 'var(--text-muted)', fontSize: '16px', width: '32px', height: '32px',
            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* Overview */}
      <div style={{
        background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px 16px',
        fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55,
      }}>
        One player is the <span style={{ color: 'var(--color-hunter)', fontWeight: 600 }}>Hunter</span> (drone),
        the other is the <span style={{ color: 'var(--color-prey)', fontWeight: 600 }}>Prey</span> (mouse).
        Roles swap every round. After <strong style={{ color: 'var(--text-primary)' }}>2 rounds</strong>, the player
        with the most points wins. Hunter wins a round by catching the prey. Prey wins by surviving all 10 turns.
      </div>

      {/* Hunter */}
      <Section title="Hunter" color="var(--color-hunter)">
        <Row label="Move" desc="Move to any adjacent tile (including diagonals to search)." />
        <Row label="Search" desc="Click an adjacent jungle tile to search it for the prey." />
        <Row
          label="Max Search"
          badge="2 uses / round"
          badgeColor="var(--color-hunter)"
          desc="Reveals all adjacent jungle tiles at once, including diagonals."
        />
        <Row
          label="EMP"
          badge="1 use / round"
          badgeColor="var(--color-hunter)"
          desc="Freezes the visible prey. They skip their next turn — you still move this turn. Use it to catch them immediately."
        />
      </Section>

      {/* Prey */}
      <Section title="Prey" color="var(--color-prey)">
        <Row label="Move" desc="Move to any adjacent tile — plains or jungle." />
        <Row
          label="Enter jungle"
          desc="Step into jungle to become hidden. Your position is kept secret via a ZK proof."
        />
        <Row
          label="Dash"
          badge="2 uses / turn"
          badgeColor="var(--color-prey)"
          desc="Move 2 tiles at once on plains. Only works when visible (not in jungle)."
        />
        <Row label="Survive" desc="Last all 10 turns without getting caught to score a point." />
      </Section>

      {/* Jungle & ZK */}
      <Section title="Jungle & hidden movement">
        <Row
          label="Hidden"
          desc="While in jungle, the hunter can't see you. Your position is committed on-chain with a ZK proof — it's cryptographically proven you didn't move to an invalid tile."
        />
        <Row
          label="Search response"
          desc="When the hunter searches, you auto-generate a ZK proof that you're not at any searched tile. If you are there — you're caught."
        />
      </Section>

      {/* Scoring */}
      <Section title="Scoring">
        <Row label="Hunter scores" desc="Step onto the prey's tile, or the prey concedes after a search." />
        <Row label="Prey scores" desc="Survive all 10 turns of the round." />
        <Row label="Match" desc="2 rounds total (1 as hunter, 1 as prey). Most points wins." />
      </Section>

      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
        Click anywhere outside to close
      </p>
    </div>
  </div>
);
