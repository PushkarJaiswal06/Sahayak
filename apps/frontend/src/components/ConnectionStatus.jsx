import React, { useState, useEffect } from 'react';
import { agentSocket, ConnectionState } from '../api/websocket';

const statusConfig = {
  [ConnectionState.CONNECTED]: {
    color: '#10b981',
    bg: '#d1fae5',
    text: 'Connected',
    show: false, // Don't show when connected
  },
  [ConnectionState.CONNECTING]: {
    color: '#3b82f6',
    bg: '#dbeafe',
    text: 'Connecting...',
    show: true,
  },
  [ConnectionState.RECONNECTING]: {
    color: '#f59e0b',
    bg: '#fef3c7',
    text: 'Reconnecting...',
    show: true,
  },
  [ConnectionState.DISCONNECTED]: {
    color: '#6b7280',
    bg: '#f3f4f6',
    text: 'Disconnected',
    show: true,
  },
  [ConnectionState.FAILED]: {
    color: '#ef4444',
    bg: '#fee2e2',
    text: 'Connection failed',
    show: true,
  },
};

export function ConnectionBanner() {
  const [state, setState] = useState(agentSocket.getState());
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleStateChange = (newState) => {
      setState(newState);
      setVisible(statusConfig[newState]?.show ?? false);
    };

    const handleReconnecting = ({ attempt }) => {
      setAttempt(attempt);
    };

    agentSocket.on('stateChange', handleStateChange);
    agentSocket.on('reconnecting', handleReconnecting);

    // Initial state
    handleStateChange(agentSocket.getState());

    return () => {
      agentSocket.off('stateChange', handleStateChange);
      agentSocket.off('reconnecting', handleReconnecting);
    };
  }, []);

  if (!visible) return null;

  const config = statusConfig[state];
  const isFailed = state === ConnectionState.FAILED;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        padding: '0.75rem 1rem',
        backgroundColor: config.bg,
        borderBottom: `2px solid ${config.color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        zIndex: 9998,
        fontSize: '0.875rem',
        animation: 'slideDown 0.3s ease-out',
      }}
    >
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      
      {/* Status indicator dot */}
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: config.color,
          animation: state === ConnectionState.RECONNECTING ? 'pulse 1.5s infinite' : 'none',
        }}
      />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>

      <span style={{ color: '#374151', fontWeight: 500 }}>
        {config.text}
        {state === ConnectionState.RECONNECTING && ` (attempt ${attempt})`}
      </span>

      {isFailed && (
        <button
          onClick={() => agentSocket.resetAndConnect()}
          style={{
            padding: '0.375rem 0.75rem',
            backgroundColor: config.color,
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '0.75rem',
          }}
        >
          Retry Connection
        </button>
      )}
    </div>
  );
}

export function ConnectionIndicator({ size = 12 }) {
  const [state, setState] = useState(agentSocket.getState());

  useEffect(() => {
    const handleStateChange = (newState) => setState(newState);
    agentSocket.on('stateChange', handleStateChange);
    return () => agentSocket.off('stateChange', handleStateChange);
  }, []);

  const config = statusConfig[state];

  return (
    <div
      title={config.text}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: config.color,
        boxShadow: `0 0 0 2px ${config.bg}`,
      }}
    />
  );
}

export default ConnectionBanner;
