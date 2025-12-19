import useAuthStore from '../stores/authStore';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/agent/v1';

// Connection states for UI
export const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  FAILED: 'failed',
};

class AgentWebSocket {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.baseDelay = 1000;
    this.maxDelay = 30000;
    this.listeners = new Map();
    this.connectionState = ConnectionState.DISCONNECTED;
    this.reconnectTimer = null;
    this.pingInterval = null;
    this.lastPong = Date.now();
  }

  getState() {
    return this.connectionState;
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect() {
    // Clear any pending reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = useAuthStore.getState().token;
    if (!token) {
      console.warn('No auth token available for WebSocket');
      this.setConnectionState(ConnectionState.DISCONNECTED);
      return;
    }

    this.setConnectionState(
      this.reconnectAttempts > 0 ? ConnectionState.RECONNECTING : ConnectionState.CONNECTING
    );

    const url = `${WS_URL}?auth_token=${encodeURIComponent(token)}`;
    
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      console.error('WebSocket creation failed:', e);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('Agent WebSocket connected');
      this.reconnectAttempts = 0;
      this.setConnectionState(ConnectionState.CONNECTED);
      this.emit('connected');
      this.startPingPong();
    };

    this.ws.onmessage = (event) => {
      try {
        // Handle pong
        if (event.data === 'pong') {
          this.lastPong = Date.now();
          return;
        }

        const data = JSON.parse(event.data);
        console.log('WS received:', data.type, data.payload);
        this.emit(data.type, data.payload);
      } catch (e) {
        console.error('WebSocket message parse error:', e);
      }
    };

    this.ws.onclose = (event) => {
      console.log('Agent WebSocket closed:', event.code, event.reason);
      this.stopPingPong();
      this.emit('disconnected', { code: event.code, reason: event.reason });
      
      // Don't reconnect if deliberately closed or auth failed
      if (event.code === 1000 || event.code === 4001 || event.code === 4003) {
        this.setConnectionState(ConnectionState.DISCONNECTED);
        return;
      }
      
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('Agent WebSocket error:', error);
      this.emit('error', error);
    };
  }

  setConnectionState(state) {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.emit('stateChange', state);
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      this.setConnectionState(ConnectionState.FAILED);
      this.emit('maxRetriesExceeded');
      return;
    }

    this.reconnectAttempts++;
    
    // Exponential backoff with jitter
    const exponentialDelay = Math.min(
      this.baseDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxDelay
    );
    const jitter = Math.random() * 0.3 * exponentialDelay;
    const delay = Math.floor(exponentialDelay + jitter);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.setConnectionState(ConnectionState.RECONNECTING);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });
    
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  startPingPong() {
    // Send ping every 25 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        // Check if we got a pong recently
        if (Date.now() - this.lastPong > 60000) {
          console.warn('WebSocket ping timeout, reconnecting...');
          this.ws.close(4000, 'Ping timeout');
          return;
        }
        
        try {
          this.ws.send(JSON.stringify({ type: 'PING' }));
        } catch (e) {
          console.error('Ping failed:', e);
        }
      }
    }, 25000);
  }

  stopPingPong() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  disconnect() {
    this.stopPingPong();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.reconnectAttempts = 0;
    this.setConnectionState(ConnectionState.DISCONNECTED);
  }

  resetAndConnect() {
    this.reconnectAttempts = 0;
    this.disconnect();
    this.connect();
  }

  sendAudioChunk(audioData) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(audioData);
    }
  }

  sendContextUpdate(context) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'CONTEXT_UPDATE',
        payload: context,
      }));
    }
  }

  sendExecutionResult(planId, status, error = null) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'EXECUTION_RESULT',
        payload: { plan_id: planId, status, error },
      }));
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    }
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach((cb) => cb(data));
  }
}

export const agentSocket = new AgentWebSocket();
export default agentSocket;
