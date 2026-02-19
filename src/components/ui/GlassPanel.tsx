import React from 'react';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  padding?: string;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  className = '',
  style,
  padding = '16px',
}) => (
  <div
    className={className}
    style={{
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(var(--glass-blur))',
      WebkitBackdropFilter: 'blur(var(--glass-blur))',
      border: '1px solid var(--glass-border)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--glass-shadow)',
      padding,
      ...style,
    }}
  >
    {children}
  </div>
);
