import React, { createContext, useEffect, useMemo, useState, useRef, useCallback } from 'react';
import agentSocket from '../api/websocket';
import useAgentExecution from '../hooks/useAgentExecution';
import useAuthStore from '../stores/authStore';

export const AgentContext = createContext(null);

function AgentContextProvider({ children }) {
  const { executePlan } = useAgentExecution();
  const { token } = useAuthStore();
  const [mode, setMode] = useState('idle'); // idle | listening | thinking | speaking | error | disconnected
  const [transcript, setTranscript] = useState('');
  const [lastPlan, setLastPlan] = useState(null);
  const [connection, setConnection] = useState({ connected: false, attempts: 0 });
  const [error, setError] = useState(null);
  const audioRef = useRef(null);

  // Play audio from base64
  const playAudio = useCallback((base64Audio, mimeType = 'audio/mpeg') => {
    try {
      const audioData = atob(base64Audio);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }
      const blob = new Blob([audioArray], { type: mimeType });
      const audioUrl = URL.createObjectURL(blob);
      
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onplay = () => setMode('speaking');
      audio.onended = () => {
        setMode('idle');
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        console.error('Audio playback error');
        setMode('idle');
      };
      
      audio.play().catch((err) => {
        console.error('Audio play failed:', err);
        setMode('idle');
      });
    } catch (err) {
      console.error('Error playing audio:', err);
      setMode('idle');
    }
  }, []);

  useEffect(() => {
    const handleConnected = () => {
      setConnection({ connected: true, attempts: 0 });
      setMode('idle');
    };

    const handleDisconnected = () => {
      setConnection((prev) => ({ connected: false, attempts: prev.attempts + 1 }));
      setMode('disconnected');
    };

    const handleError = (err) => {
      setError(err?.message || 'Agent connection error');
      setMode('error');
    };

    const handleSTT = (payload) => {
      setMode('listening');
      if (payload?.text) setTranscript(payload.text);
    };

    const handlePlan = async (payload) => {
      setMode('thinking');
      setLastPlan(payload);
      setTranscript('');
      try {
        const result = await executePlan(payload);
        agentSocket.sendExecutionResult(payload.plan_id, result.status, result.error || null);
      } catch (execErr) {
        agentSocket.sendExecutionResult(payload.plan_id, 'failed', execErr.message);
      }
    };

    const handleSpeak = (payload) => {
      // Update transcript with what agent says
      if (payload?.text) {
        setTranscript(payload.text);
      }
      
      // Play audio if available
      if (payload?.audio_base64) {
        playAudio(payload.audio_base64, payload.mime_type || 'audio/mpeg');
      } else if (payload?.use_browser_tts && payload?.text) {
        // Use browser's built-in speech synthesis as fallback
        setMode('speaking');
        const utterance = new SpeechSynthesisUtterance(payload.text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.onend = () => setMode('idle');
        utterance.onerror = () => setMode('idle');
        window.speechSynthesis.speak(utterance);
      } else {
        // No audio, just show text
        setMode('idle');
      }
    };

    agentSocket.on('connected', handleConnected);
    agentSocket.on('disconnected', handleDisconnected);
    agentSocket.on('error', handleError);
    agentSocket.on('TRANSCRIPT_PARTIAL', handleSTT);
    agentSocket.on('TRANSCRIPT_FINAL', handleSTT);
    agentSocket.on('ACTION_DISPATCH', handlePlan);
    agentSocket.on('AGENT_SPEAK', handleSpeak);

    if (token) {
      agentSocket.connect();
    }

    return () => {
      agentSocket.off('connected', handleConnected);
      agentSocket.off('disconnected', handleDisconnected);
      agentSocket.off('error', handleError);
      agentSocket.off('TRANSCRIPT_PARTIAL', handleSTT);
      agentSocket.off('TRANSCRIPT_FINAL', handleSTT);
      agentSocket.off('ACTION_DISPATCH', handlePlan);
      agentSocket.off('AGENT_SPEAK', handleSpeak);
      agentSocket.disconnect();
    };
  }, [executePlan, token, playAudio]);

  const sendMessage = useCallback((msg) => {
    if (agentSocket.ws && agentSocket.ws.readyState === WebSocket.OPEN) {
      agentSocket.ws.send(JSON.stringify(msg));
    }
  }, []);

  const sendBinary = useCallback((data) => {
    if (agentSocket.ws && agentSocket.ws.readyState === WebSocket.OPEN) {
      agentSocket.ws.send(data);
    }
  }, []);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      transcript,
      lastPlan,
      connection,
      error,
      setTranscript,
      setLastPlan,
      setError,
      sendContextUpdate: agentSocket.sendContextUpdate.bind(agentSocket),
      sendAudioChunk: agentSocket.sendAudioChunk.bind(agentSocket),
      sendMessage,
      sendBinary,
    }),
    [mode, transcript, lastPlan, connection, error, sendMessage, sendBinary]
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export default AgentContextProvider;
