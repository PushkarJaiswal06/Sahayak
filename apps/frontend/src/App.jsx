import React from 'react';
import AgentContextProvider from './contexts/AgentContext';

function App() {
  return (
    <AgentContextProvider>
      <main style={{ padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}>
        <h1>Sahayak Banking</h1>
        <p>Scaffold ready. Build features: dashboard, transfers, bills, profile, and voice agent overlay.</p>
      </main>
    </AgentContextProvider>
  );
}

export default App;
