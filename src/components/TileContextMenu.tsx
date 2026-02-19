import React, { useEffect, useRef } from 'react';

interface TileContextMenuProps {
  screenX: number;
  screenY: number;
  canMove: boolean;
  canSearch: boolean;
  onMove: () => void;
  onSearch: () => void;
  onClose: () => void;
}

export const TileContextMenu: React.FC<TileContextMenuProps> = ({
  screenX,
  screenY,
  canMove,
  canSearch,
  onMove,
  onSearch,
  onClose,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Small delay so the same click that opens it doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 80);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  // Smart positioning: avoid screen edges
  const menuWidth = 140;
  const menuHeight = (canMove ? 44 : 0) + (canSearch ? 44 : 0) + 16;
  const margin = 12;
  let x = screenX + 12;
  let y = screenY - menuHeight / 2;
  if (x + menuWidth > window.innerWidth - margin) x = screenX - menuWidth - 12;
  if (y < margin) y = margin;
  if (y + menuHeight > window.innerHeight - margin) y = window.innerHeight - menuHeight - margin;

  const btnBase: React.CSSProperties = {
    display: 'block',
    width: '100%',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    padding: '10px 16px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    transition: 'background 0.15s',
  };

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '6px',
        background: 'rgba(10, 10, 18, 0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
        minWidth: menuWidth,
      }}
    >
      {canMove && (
        <button
          onClick={(e) => { e.stopPropagation(); onMove(); onClose(); }}
          style={{ ...btnBase, background: 'rgba(100, 210, 255, 0.1)', color: '#64d2ff', border: '1px solid rgba(100, 210, 255, 0.2)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(100, 210, 255, 0.22)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(100, 210, 255, 0.1)'; }}
        >
          Move here
        </button>
      )}
      {canSearch && (
        <button
          onClick={(e) => { e.stopPropagation(); onSearch(); onClose(); }}
          style={{ ...btnBase, background: 'rgba(255, 214, 10, 0.08)', color: '#ffd60a', border: '1px solid rgba(255, 214, 10, 0.2)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 214, 10, 0.2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 214, 10, 0.08)'; }}
        >
          Search
        </button>
      )}
    </div>
  );
};
