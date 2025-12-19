# Voice Agent Web Component

A standalone Web Component that provides voice agent functionality for any website.

## Features

- Drop-in voice assistant for any website
- Framework-agnostic (works with React, Vue, Angular, vanilla JS)
- Customizable appearance
- Event-driven API
- Shadow DOM encapsulation

## Installation

### NPM

```bash
npm install @sahayak/voice-agent-element
```

### CDN

```html
<script type="module" src="https://cdn.sahayak.dev/voice-agent-element.min.js"></script>
```

## Usage

### Basic HTML

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module" src="voice-agent-element.js"></script>
</head>
<body>
  <voice-agent
    stt-provider="deepgram"
    stt-api-key="your-deepgram-key"
    llm-provider="groq"
    llm-api-key="your-groq-key"
    tts-provider="edge-tts"
    voice="en-US-AriaNeural"
  ></voice-agent>
</body>
</html>
```

### React

```tsx
import '@sahayak/voice-agent-element';

function App() {
  const handleTranscript = (e) => {
    console.log('User said:', e.detail.text);
  };

  const handleResponse = (e) => {
    console.log('Agent response:', e.detail);
  };

  return (
    <voice-agent
      stt-provider="deepgram"
      stt-api-key={process.env.DEEPGRAM_API_KEY}
      llm-provider="groq"
      llm-api-key={process.env.GROQ_API_KEY}
      tts-provider="edge-tts"
      onTranscript={handleTranscript}
      onResponse={handleResponse}
    />
  );
}
```

### Vue

```vue
<template>
  <voice-agent
    stt-provider="deepgram"
    :stt-api-key="sttApiKey"
    llm-provider="groq"
    :llm-api-key="llmApiKey"
    tts-provider="edge-tts"
    @transcript="onTranscript"
    @response="onResponse"
  />
</template>

<script setup>
import '@sahayak/voice-agent-element';

const sttApiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
const llmApiKey = import.meta.env.VITE_GROQ_API_KEY;

function onTranscript(e) {
  console.log('User said:', e.detail.text);
}

function onResponse(e) {
  console.log('Agent response:', e.detail);
}
</script>
```

## Web Component Implementation

```typescript
// voice-agent-element.ts

import { VoiceAgent, VoiceAgentConfig } from '@sahayak/voice-agent-core';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
    }
    
    .container {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 12px;
    }
    
    .fab {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
      transition: all 0.3s ease;
    }
    
    .fab:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 25px rgba(102, 126, 234, 0.5);
    }
    
    .fab.listening {
      animation: pulse 1.5s ease-in-out infinite;
    }
    
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.4); }
      70% { box-shadow: 0 0 0 15px rgba(102, 126, 234, 0); }
      100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0); }
    }
    
    .fab svg {
      width: 24px;
      height: 24px;
      fill: white;
    }
    
    .transcript-bubble {
      max-width: 300px;
      padding: 12px 16px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.3s ease;
    }
    
    .transcript-bubble.visible {
      opacity: 1;
      transform: translateY(0);
    }
    
    .transcript-bubble .label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 4px;
    }
    
    .transcript-bubble .text {
      font-size: 14px;
      color: #333;
      line-height: 1.4;
    }
    
    .panel {
      position: absolute;
      bottom: 70px;
      right: 0;
      width: 350px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
      display: none;
      flex-direction: column;
      overflow: hidden;
    }
    
    .panel.open {
      display: flex;
    }
    
    .panel-header {
      padding: 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .panel-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
    
    .panel-body {
      padding: 16px;
      max-height: 300px;
      overflow-y: auto;
    }
    
    .message {
      margin-bottom: 12px;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.4;
    }
    
    .message.user {
      background: #f0f0f0;
      margin-left: 40px;
    }
    
    .message.assistant {
      background: #e8f0fe;
      margin-right: 40px;
    }
    
    .suggestions {
      padding: 12px 16px;
      border-top: 1px solid #eee;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .suggestion {
      padding: 6px 12px;
      background: #f5f5f5;
      border: 1px solid #e0e0e0;
      border-radius: 16px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .suggestion:hover {
      background: #e8f0fe;
      border-color: #667eea;
    }
  </style>
  
  <div class="container">
    <div class="transcript-bubble" id="transcript">
      <div class="label">You said:</div>
      <div class="text" id="transcript-text"></div>
    </div>
    
    <div class="panel" id="panel">
      <div class="panel-header">
        <h3>Voice Assistant</h3>
        <button class="close-btn" id="close-panel">✕</button>
      </div>
      <div class="panel-body" id="messages"></div>
      <div class="suggestions" id="suggestions"></div>
    </div>
    
    <button class="fab" id="fab">
      <svg viewBox="0 0 24 24" id="mic-icon">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
      </svg>
    </button>
  </div>
`;

export class VoiceAgentElement extends HTMLElement {
  private agent: VoiceAgent | null = null;
  private shadow: ShadowRoot;
  private isListening = false;
  private messages: Array<{ role: 'user' | 'assistant'; text: string }> = [];
  
  // Observed attributes
  static get observedAttributes() {
    return [
      'stt-provider', 'stt-api-key', 'stt-model',
      'llm-provider', 'llm-api-key', 'llm-model',
      'tts-provider', 'tts-api-key', 'voice',
      'system-prompt', 'language', 'theme'
    ];
  }
  
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.appendChild(template.content.cloneNode(true));
    
    // Bind event handlers
    this.handleFabClick = this.handleFabClick.bind(this);
    this.handleClosePanelClick = this.handleClosePanelClick.bind(this);
  }
  
  connectedCallback() {
    // Setup event listeners
    const fab = this.shadow.getElementById('fab')!;
    fab.addEventListener('click', this.handleFabClick);
    
    const closePanel = this.shadow.getElementById('close-panel')!;
    closePanel.addEventListener('click', this.handleClosePanelClick);
    
    // Initialize agent
    this.initializeAgent();
  }
  
  disconnectedCallback() {
    if (this.agent) {
      this.agent.stop();
      this.agent = null;
    }
  }
  
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue && this.agent) {
      // Reinitialize with new config
      this.initializeAgent();
    }
  }
  
  private async initializeAgent() {
    const config: VoiceAgentConfig = {
      stt: {
        provider: (this.getAttribute('stt-provider') as any) || 'deepgram',
        apiKey: this.getAttribute('stt-api-key') || '',
        model: this.getAttribute('stt-model') || undefined
      },
      llm: {
        provider: (this.getAttribute('llm-provider') as any) || 'groq',
        apiKey: this.getAttribute('llm-api-key') || '',
        model: this.getAttribute('llm-model') || 'llama-3.3-70b-versatile'
      },
      tts: {
        provider: (this.getAttribute('tts-provider') as any) || 'edge-tts',
        apiKey: this.getAttribute('tts-api-key') || undefined,
        voice: this.getAttribute('voice') || 'en-US-AriaNeural'
      },
      systemPrompt: this.getAttribute('system-prompt') || 'You are a helpful assistant.',
      language: this.getAttribute('language') || 'en-US'
    };
    
    this.agent = new VoiceAgent(config);
    
    // Setup event listeners
    this.agent.on('transcript', (transcript) => {
      this.showTranscript(transcript.text);
      
      if (transcript.isFinal) {
        this.addMessage('user', transcript.text);
        this.dispatchEvent(new CustomEvent('transcript', {
          detail: transcript,
          bubbles: true,
          composed: true
        }));
      }
    });
    
    this.agent.on('response', (response) => {
      this.addMessage('assistant', response.text);
      
      if (response.suggestions) {
        this.showSuggestions(response.suggestions);
      }
      
      this.dispatchEvent(new CustomEvent('response', {
        detail: response,
        bubbles: true,
        composed: true
      }));
    });
    
    this.agent.on('stateChange', ({ current }) => {
      this.dispatchEvent(new CustomEvent('statechange', {
        detail: { state: current },
        bubbles: true,
        composed: true
      }));
    });
    
    this.agent.on('error', (error) => {
      this.dispatchEvent(new CustomEvent('error', {
        detail: { error },
        bubbles: true,
        composed: true
      }));
    });
    
    await this.agent.initialize();
  }
  
  private async handleFabClick() {
    if (!this.agent) return;
    
    const fab = this.shadow.getElementById('fab')!;
    
    if (this.isListening) {
      await this.agent.stop();
      fab.classList.remove('listening');
      this.isListening = false;
    } else {
      await this.agent.start();
      fab.classList.add('listening');
      this.isListening = true;
    }
  }
  
  private handleClosePanelClick() {
    const panel = this.shadow.getElementById('panel')!;
    panel.classList.remove('open');
  }
  
  private showTranscript(text: string) {
    const bubble = this.shadow.getElementById('transcript')!;
    const textEl = this.shadow.getElementById('transcript-text')!;
    
    textEl.textContent = text;
    bubble.classList.add('visible');
    
    setTimeout(() => {
      bubble.classList.remove('visible');
    }, 3000);
  }
  
  private addMessage(role: 'user' | 'assistant', text: string) {
    this.messages.push({ role, text });
    
    const messagesEl = this.shadow.getElementById('messages')!;
    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}`;
    messageEl.textContent = text;
    messagesEl.appendChild(messageEl);
    
    // Scroll to bottom
    messagesEl.scrollTop = messagesEl.scrollHeight;
    
    // Open panel
    const panel = this.shadow.getElementById('panel')!;
    panel.classList.add('open');
  }
  
  private showSuggestions(suggestions: string[]) {
    const suggestionsEl = this.shadow.getElementById('suggestions')!;
    suggestionsEl.innerHTML = '';
    
    for (const suggestion of suggestions) {
      const btn = document.createElement('button');
      btn.className = 'suggestion';
      btn.textContent = suggestion;
      btn.addEventListener('click', () => {
        if (this.agent) {
          this.agent.processText(suggestion);
        }
      });
      suggestionsEl.appendChild(btn);
    }
  }
  
  // Public API
  
  async start() {
    if (this.agent && !this.isListening) {
      await this.agent.start();
      this.isListening = true;
      this.shadow.getElementById('fab')!.classList.add('listening');
    }
  }
  
  async stop() {
    if (this.agent && this.isListening) {
      await this.agent.stop();
      this.isListening = false;
      this.shadow.getElementById('fab')!.classList.remove('listening');
    }
  }
  
  async processText(text: string) {
    if (this.agent) {
      return this.agent.processText(text);
    }
  }
  
  async speak(text: string) {
    if (this.agent) {
      return this.agent.speak(text);
    }
  }
  
  clearHistory() {
    this.messages = [];
    const messagesEl = this.shadow.getElementById('messages')!;
    messagesEl.innerHTML = '';
    
    if (this.agent) {
      this.agent.clearHistory();
    }
  }
}

// Register custom element
customElements.define('voice-agent', VoiceAgentElement);

// Type declarations for JSX
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'voice-agent': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'stt-provider'?: string;
          'stt-api-key'?: string;
          'stt-model'?: string;
          'llm-provider'?: string;
          'llm-api-key'?: string;
          'llm-model'?: string;
          'tts-provider'?: string;
          'tts-api-key'?: string;
          'voice'?: string;
          'system-prompt'?: string;
          'language'?: string;
          'theme'?: string;
          onTranscript?: (e: CustomEvent) => void;
          onResponse?: (e: CustomEvent) => void;
          onStatechange?: (e: CustomEvent) => void;
          onError?: (e: CustomEvent) => void;
        },
        HTMLElement
      >;
    }
  }
}
```

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `stt-provider` | string | `'deepgram'` | STT provider: `deepgram`, `whisper`, `browser` |
| `stt-api-key` | string | - | API key for STT provider |
| `stt-model` | string | - | STT model to use |
| `llm-provider` | string | `'groq'` | LLM provider: `groq`, `openai`, `ollama` |
| `llm-api-key` | string | - | API key for LLM provider |
| `llm-model` | string | `'llama-3.3-70b-versatile'` | LLM model to use |
| `tts-provider` | string | `'edge-tts'` | TTS provider: `edge-tts`, `elevenlabs`, `browser` |
| `tts-api-key` | string | - | API key for TTS provider |
| `voice` | string | `'en-US-AriaNeural'` | Voice to use for TTS |
| `system-prompt` | string | `'You are a helpful assistant.'` | System prompt for LLM |
| `language` | string | `'en-US'` | Language code |
| `theme` | string | `'default'` | Visual theme |

## Events

| Event | Detail | Description |
|-------|--------|-------------|
| `transcript` | `{ text, confidence, isFinal }` | Fired when speech is transcribed |
| `response` | `{ text, actions, suggestions }` | Fired when agent responds |
| `statechange` | `{ state }` | Fired when agent state changes |
| `error` | `{ error }` | Fired when an error occurs |

## Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `start()` | - | `Promise<void>` | Start listening |
| `stop()` | - | `Promise<void>` | Stop listening |
| `processText(text)` | `text: string` | `Promise<Response>` | Process text input |
| `speak(text)` | `text: string` | `Promise<void>` | Speak text |
| `clearHistory()` | - | `void` | Clear conversation history |

## CSS Custom Properties

```css
voice-agent {
  /* Position */
  --va-position-bottom: 20px;
  --va-position-right: 20px;
  
  /* FAB Button */
  --va-fab-size: 56px;
  --va-fab-bg: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --va-fab-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
  
  /* Panel */
  --va-panel-width: 350px;
  --va-panel-bg: white;
  --va-panel-radius: 16px;
  --va-panel-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  
  /* Messages */
  --va-user-msg-bg: #f0f0f0;
  --va-assistant-msg-bg: #e8f0fe;
  
  /* Typography */
  --va-font-family: system-ui, -apple-system, sans-serif;
  --va-font-size: 14px;
}
```

## Building

```bash
npm install
npm run build
```

Output:
- `dist/voice-agent-element.js` - ES Module
- `dist/voice-agent-element.min.js` - Minified bundle
- `dist/voice-agent-element.d.ts` - TypeScript declarations
