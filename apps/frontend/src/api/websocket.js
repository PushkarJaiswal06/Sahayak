import useAuthStore from '../stores/authStore';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/agent/v1';

class AgentWebSocket {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const token = useAuthStore.getState().token;
    if (!token) {
      console.warn('No auth token available for WebSocket');
      return;
    }

    const url = `${WS_URL}?auth_token=${encodeURIComponent(token)}`;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log('Agent WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connected');
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.type, data.payload);
      } catch (e) {
        console.error('WebSocket message parse error:', e);
      }
    };

    this.socket.onclose = (event) => {
      console.log('Agent WebSocket closed:', event.code);
      this.emit('disconnected');
      this.attemptReconnect();
    };

    this.socket.onerror = (error) => {
      console.error('Agent WebSocket error:', error);
      this.emit('error', error);
    };
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  sendAudioChunk(audioData) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(audioData);
    }
  }

  sendContextUpdate(context) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'CONTEXT_UPDATE',
        payload: context,
      }));
    }
  }

  sendExecutionResult(planId, status, error = null) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
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
