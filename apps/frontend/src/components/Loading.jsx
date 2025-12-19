import React from 'react';

export function LoadingSpinner({ size = 40, color = '#3b82f6' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 50 50"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="80, 200"
        strokeDashoffset="0"
      />
      <style>{`
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  );
}

export function LoadingOverlay({ message = 'Loading...' }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <LoadingSpinner size={48} />
      <p style={{ marginTop: '1rem', color: '#64748b', fontWeight: 500 }}>
        {message}
      </p>
    </div>
  );
}

export function LoadingCard() {
  return (
    <div style={{
      padding: '2rem',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem',
    }}>
      <LoadingSpinner size={32} />
      <p style={{ margin: 0, color: '#64748b' }}>Loading...</p>
    </div>
  );
}

export function SkeletonLine({ width = '100%', height = '1rem' }) {
  return (
    <div style={{
      width,
      height,
      backgroundColor: '#e2e8f0',
      borderRadius: '4px',
      animation: 'pulse 2s infinite',
    }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div style={{
      padding: '1.5rem',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    }}>
      <SkeletonLine width="40%" height="1.5rem" />
      <div style={{ height: '1rem' }} />
      <SkeletonLine width="100%" />
      <div style={{ height: '0.5rem' }} />
      <SkeletonLine width="80%" />
      <div style={{ height: '0.5rem' }} />
      <SkeletonLine width="60%" />
    </div>
  );
}

export default LoadingSpinner;
