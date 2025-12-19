import React, { useRef, useState, useCallback } from 'react';
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
  const { mode, setMode, transcript, connection, sendMessage, sendBinary } = React.useContext(AgentContext);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      streamRef.current = stream;

      // Use webm for browser compatibility
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setMode('thinking');
        
        // Combine all chunks into a complete WebM file
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log('Audio recorded:', audioBlob.size, 'bytes');
        
        // Send the complete audio file as binary
        const buffer = await audioBlob.arrayBuffer();
        if (sendBinary) {
          sendBinary(new Uint8Array(buffer));
        }
        
        // Signal end of audio
        if (sendMessage) {
          sendMessage({ type: 'AUDIO_END', payload: {} });
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        audioChunksRef.current = [];
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setMode('listening');
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setMode('error');
    }
  }, [sendMessage, sendBinary, setMode]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const handleOrbClick = useCallback(() => {
    if (!connection.connected) {
      return;
    }
    
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [connection.connected, isRecording, startRecording, stopRecording]);

  // Send text command for testing (press Enter in console)
  const sendTextCommand = useCallback((text) => {
    if (sendMessage && text) {
      sendMessage({ type: 'TEXT_COMMAND', payload: { text } });
      setMode('thinking');
    }
  }, [sendMessage, setMode]);

  // Expose for debugging
  React.useEffect(() => {
    window.sendTextCommand = sendTextCommand;
  }, [sendTextCommand]);

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
      <button
        onClick={handleOrbClick}
        disabled={!connection.connected}
        aria-label="voice-orb-button"
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: statusColor(mode),
          border: 'none',
          cursor: connection.connected ? 'pointer' : 'not-allowed',
          transition: 'transform 200ms ease, box-shadow 200ms ease',
          boxShadow: `0 0 0 6px ${statusColor(mode)}22`,
          animation: mode === 'listening' ? 'pulse 1.2s ease-in-out infinite' : 'none',
        }}
        title={isRecording ? 'Click to stop recording' : 'Click to start recording'}
      />
      <div style={{ maxWidth: '280px' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
          {mode === 'listening' && 'Listening…'}
          {mode === 'thinking' && 'Thinking…'}
          {mode === 'speaking' && 'Speaking…'}
          {mode === 'error' && 'Agent error'}
          {mode === 'disconnected' && 'Reconnecting…'}
          {mode === 'idle' && 'Ready'}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#cbd5e1', minHeight: '20px' }}>
          {transcript || (connection.connected ? 'Click orb to speak' : 'Connecting to agent…')}
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
