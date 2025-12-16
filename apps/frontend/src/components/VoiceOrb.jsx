import React from 'react';
import { AgentContext } from '../contexts/AgentContext';

function statusColor(mode) {
  switch (mode) {
    case 'listening':
      return '#10b981';
    case 'thinking':
      return '#f59e0b';
    case 'speaking':
      return '#6366f1';
    case 'error':
      return '#ef4444';
    case 'disconnected':
      return '#9ca3af';
    default:
      return '#6b7280';
  }
}

function VoiceOrb() {
  const { mode, transcript, connection } = React.useContext(AgentContext);

  return (
    <div
      style={{
        position: 'fixed',
        right: '1.5rem',
        bottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        background: '#0f172a',
        color: '#e5e7eb',
        padding: '0.9rem 1.1rem',
        borderRadius: '999px',
        boxShadow: '0 10px 35px rgba(0,0,0,0.25)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        aria-label="voice-orb-status"
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: statusColor(mode),
          transition: 'transform 200ms ease, box-shadow 200ms ease',
          boxShadow: `0 0 0 6px ${statusColor(mode)}22`,
          animation: mode === 'listening' ? 'pulse 1.2s ease-in-out infinite' : 'none',
        }}
      />
      <div style={{ maxWidth: '280px' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
          {mode === 'listening' && 'Listening…'}
          {mode === 'thinking' && 'Thinking…'}
          {mode === 'speaking' && 'Speaking…'}
          {mode === 'error' && 'Agent error'}
          {mode === 'disconnected' && 'Reconnecting…'}
          {mode === 'idle' && 'Idle'}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#cbd5e1', minHeight: '20px' }}>
          {transcript || (connection.connected ? 'Say a command to start' : 'Connecting to agent…')}
        </div>
      </div>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.07); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export default VoiceOrb;
