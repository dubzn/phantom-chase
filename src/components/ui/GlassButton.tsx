import React from 'react';

type Variant = 'primary' | 'danger' | 'secondary' | 'ghost';
type Size = 'sm' | 'md';

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--btn-primary-bg)',
    border: '1px solid var(--btn-primary-border)',
    color: 'var(--btn-primary-text)',
  },
  danger: {
    background: 'var(--btn-danger-bg)',
    border: '1px solid var(--btn-danger-border)',
    color: 'var(--btn-danger-text)',
  },
  secondary: {
    background: 'var(--btn-secondary-bg)',
    border: '1px solid var(--btn-secondary-border)',
    color: 'var(--btn-secondary-text)',
  },
  ghost: {
    background: 'transparent',
    border: '1px solid transparent',
    color: 'var(--text-secondary)',
  },
};

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { padding: '8px 16px', fontSize: '13px' },
  md: { padding: '13px 24px', fontSize: '15px' },
};

export const GlassButton: React.FC<GlassButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  disabled,
  style,
  children,
  ...rest
}) => {
  const vs = variantStyles[variant];
  const ss = sizeStyles[size];

  return (
    <button
      disabled={disabled}
      style={{
        ...vs,
        ...ss,
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'inherit',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 0.2s, border-color 0.2s, opacity 0.2s',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = 'var(--glass-bg-hover)';
          e.currentTarget.style.borderColor = 'var(--glass-border-hover)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = vs.background as string;
        e.currentTarget.style.borderColor = (vs.border as string).replace('1px solid ', '');
      }}
      {...rest}
    >
      {children}
    </button>
  );
};
