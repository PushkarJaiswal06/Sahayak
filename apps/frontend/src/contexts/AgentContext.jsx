import React, { createContext, useMemo, useState } from 'react';

export const AgentContext = createContext(null);

function AgentContextProvider({ children }) {
  const [state, setState] = useState({ mode: 'idle', lastPlan: null, error: null });

  const value = useMemo(() => ({ state, setState }), [state]);

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export default AgentContextProvider;
