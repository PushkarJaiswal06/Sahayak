import React, { createContext, useEffect, useMemo, useState } from 'react';
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
      try {
        const result = await executePlan(payload);
        agentSocket.sendExecutionResult(payload.plan_id, result.status, result.error || null);
      } catch (execErr) {
        agentSocket.sendExecutionResult(payload.plan_id, 'failed', execErr.message);
      }
    };

    const handleTTS = (payload) => {
      // Placeholder for audio playback; mark speaking state for UI.
      if (payload?.audio_url) {
        setMode('speaking');
      }
    };

    agentSocket.on('connected', handleConnected);
    agentSocket.on('disconnected', handleDisconnected);
    agentSocket.on('error', handleError);
    agentSocket.on('TRANSCRIPT_PARTIAL', handleSTT);
    agentSocket.on('TRANSCRIPT_FINAL', handleSTT);
    agentSocket.on('AGENT_PLAN', handlePlan);
    agentSocket.on('AGENT_TTS', handleTTS);

    if (token) {
      agentSocket.connect();
    }

    return () => {
      agentSocket.off('connected', handleConnected);
      agentSocket.off('disconnected', handleDisconnected);
      agentSocket.off('error', handleError);
      agentSocket.off('TRANSCRIPT_PARTIAL', handleSTT);
      agentSocket.off('TRANSCRIPT_FINAL', handleSTT);
      agentSocket.off('AGENT_PLAN', handlePlan);
      agentSocket.off('AGENT_TTS', handleTTS);
      agentSocket.disconnect();
    };
  }, [executePlan, token]);

  const value = useMemo(
    () => ({
      mode,
      transcript,
      lastPlan,
      connection,
      error,
      setMode,
      setTranscript,
      setLastPlan,
      setError,
      sendContextUpdate: agentSocket.sendContextUpdate.bind(agentSocket),
      sendAudioChunk: agentSocket.sendAudioChunk.bind(agentSocket),
    }),
    [mode, transcript, lastPlan, connection, error]
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export default AgentContextProvider;
