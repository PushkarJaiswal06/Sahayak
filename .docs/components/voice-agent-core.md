# Voice Agent Core Abstraction

## Overview

This document describes the core abstraction layer for the Sahayak Voice Agent that will be extracted and open-sourced as a reusable library.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    VoiceAgentCore                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    State Machine                         │    │
│  │  IDLE ─► LISTENING ─► PROCESSING ─► SPEAKING ─► IDLE    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │ STT Module  │     │ LLM Module  │     │ TTS Module  │       │
│  │             │     │             │     │             │       │
│  │ ┌─────────┐ │     │ ┌─────────┐ │     │ ┌─────────┐ │       │
│  │ │Provider │ │     │ │Provider │ │     │ │Provider │ │       │
│  │ │Interface│ │     │ │Interface│ │     │ │Interface│ │       │
│  │ └─────────┘ │     │ └─────────┘ │     │ └─────────┘ │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│         │                    │                    │             │
│         └────────────────────┼────────────────────┘             │
│                              │                                   │
│                              ▼                                   │
│                    ┌─────────────────┐                          │
│                    │ Event Emitter   │                          │
│                    │ (transcript,    │                          │
│                    │  response,      │                          │
│                    │  action, etc.)  │                          │
│                    └─────────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Interfaces

### VoiceAgent

```typescript
// @sahayak/voice-agent-core

import { EventEmitter } from 'events';

export interface VoiceAgentConfig {
  // Speech-to-Text configuration
  stt: STTConfig;
  
  // Large Language Model configuration
  llm: LLMConfig;
  
  // Text-to-Speech configuration
  tts: TTSConfig;
  
  // Action handlers
  actions?: ActionHandler[];
  
  // System prompt for the LLM
  systemPrompt?: string;
  
  // Language for STT/TTS
  language?: string;
  
  // Enable debug logging
  debug?: boolean;
}

export interface STTConfig {
  provider: 'deepgram' | 'whisper' | 'google' | 'browser' | 'custom';
  apiKey?: string;
  endpoint?: string;
  model?: string;
  language?: string;
  interimResults?: boolean;
  customProvider?: STTProvider;
}

export interface LLMConfig {
  provider: 'groq' | 'openai' | 'anthropic' | 'ollama' | 'custom';
  apiKey?: string;
  endpoint?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  customProvider?: LLMProvider;
}

export interface TTSConfig {
  provider: 'edge-tts' | 'elevenlabs' | 'google' | 'browser' | 'custom';
  apiKey?: string;
  voice?: string;
  rate?: number;
  pitch?: number;
  customProvider?: TTSProvider;
}

export type VoiceAgentState = 
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error';

export interface Transcript {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: number;
  words?: TranscriptWord[];
}

export interface TranscriptWord {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface Response {
  text: string;
  intent?: string;
  confidence?: number;
  actions?: ActionPlan[];
  metadata?: Record<string, any>;
}

export interface ActionPlan {
  type: string;
  target?: string;
  params?: Record<string, any>;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

export interface ActionHandler {
  type: string;
  handle: (action: ActionPlan) => Promise<ActionResult>;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  data?: any;
}

export class VoiceAgent extends EventEmitter {
  private config: VoiceAgentConfig;
  private state: VoiceAgentState = 'idle';
  private sttProvider: STTProvider;
  private llmProvider: LLMProvider;
  private ttsProvider: TTSProvider;
  private actionHandlers: Map<string, ActionHandler>;
  private conversationHistory: Message[];
  
  constructor(config: VoiceAgentConfig) {
    super();
    this.config = config;
    this.actionHandlers = new Map();
    this.conversationHistory = [];
    
    // Register action handlers
    if (config.actions) {
      for (const handler of config.actions) {
        this.registerAction(handler);
      }
    }
  }
  
  /**
   * Initialize all providers
   */
  async initialize(): Promise<void> {
    // Initialize STT provider
    this.sttProvider = await this.createSTTProvider(this.config.stt);
    await this.sttProvider.initialize();
    
    // Initialize LLM provider
    this.llmProvider = await this.createLLMProvider(this.config.llm);
    await this.llmProvider.initialize();
    
    // Initialize TTS provider
    this.ttsProvider = await this.createTTSProvider(this.config.tts);
    await this.ttsProvider.initialize();
    
    this.emit('initialized');
  }
  
  /**
   * Start listening for voice input
   */
  async start(): Promise<void> {
    if (this.state !== 'idle') {
      throw new Error(`Cannot start from state: ${this.state}`);
    }
    
    this.setState('listening');
    
    // Start STT provider
    this.sttProvider.onTranscript((transcript) => {
      this.handleTranscript(transcript);
    });
    
    await this.sttProvider.start();
    this.emit('start');
  }
  
  /**
   * Stop listening
   */
  async stop(): Promise<void> {
    await this.sttProvider.stop();
    this.setState('idle');
    this.emit('stop');
  }
  
  /**
   * Speak text using TTS
   */
  async speak(text: string): Promise<void> {
    const previousState = this.state;
    this.setState('speaking');
    
    const audioStream = this.ttsProvider.synthesizeStream(text);
    
    for await (const chunk of audioStream) {
      this.emit('audio', chunk);
    }
    
    this.setState(previousState === 'speaking' ? 'idle' : previousState);
  }
  
  /**
   * Process text input directly (without STT)
   */
  async processText(text: string): Promise<Response> {
    this.setState('processing');
    
    // Add to conversation history
    this.conversationHistory.push({
      role: 'user',
      content: text
    });
    
    // Generate response from LLM
    const llmResponse = await this.llmProvider.generate({
      messages: this.conversationHistory,
      systemPrompt: this.buildSystemPrompt()
    });
    
    // Parse response
    const response = this.parseResponse(llmResponse);
    
    // Add to conversation history
    this.conversationHistory.push({
      role: 'assistant',
      content: response.text
    });
    
    this.emit('response', response);
    
    // Execute actions
    if (response.actions) {
      await this.executeActions(response.actions);
    }
    
    this.setState('idle');
    return response;
  }
  
  /**
   * Register an action handler
   */
  registerAction(handler: ActionHandler): void {
    this.actionHandlers.set(handler.type, handler);
  }
  
  /**
   * Set conversation context
   */
  setContext(context: Record<string, any>): void {
    this.context = context;
  }
  
  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }
  
  /**
   * Get current state
   */
  getState(): VoiceAgentState {
    return this.state;
  }
  
  // Private methods
  
  private setState(state: VoiceAgentState): void {
    const previousState = this.state;
    this.state = state;
    this.emit('stateChange', { previous: previousState, current: state });
  }
  
  private async handleTranscript(transcript: Transcript): Promise<void> {
    this.emit('transcript', transcript);
    
    if (transcript.isFinal) {
      const response = await this.processText(transcript.text);
      
      // Speak the response
      if (response.text) {
        await this.speak(response.text);
      }
    }
  }
  
  private async executeActions(actions: ActionPlan[]): Promise<void> {
    for (const action of actions) {
      const handler = this.actionHandlers.get(action.type);
      
      if (!handler) {
        this.emit('error', new Error(`No handler for action: ${action.type}`));
        continue;
      }
      
      // Check if confirmation is required
      if (action.requiresConfirmation) {
        const confirmed = await this.requestConfirmation(action);
        if (!confirmed) {
          this.emit('actionCancelled', action);
          continue;
        }
      }
      
      this.emit('actionStart', action);
      
      try {
        const result = await handler.handle(action);
        this.emit('actionComplete', { action, result });
      } catch (error) {
        this.emit('actionError', { action, error });
      }
    }
  }
  
  private async requestConfirmation(action: ActionPlan): Promise<boolean> {
    return new Promise((resolve) => {
      this.emit('confirmationRequired', {
        action,
        confirm: () => resolve(true),
        cancel: () => resolve(false)
      });
    });
  }
  
  private buildSystemPrompt(): string {
    const basePrompt = this.config.systemPrompt || 'You are a helpful assistant.';
    
    // Add context if available
    let prompt = basePrompt;
    if (this.context) {
      prompt += `\n\nCurrent context:\n${JSON.stringify(this.context, null, 2)}`;
    }
    
    // Add available actions
    if (this.actionHandlers.size > 0) {
      prompt += `\n\nAvailable actions:\n`;
      for (const [type, handler] of this.actionHandlers) {
        prompt += `- ${type}\n`;
      }
    }
    
    return prompt;
  }
  
  private parseResponse(llmResponse: string): Response {
    // Try to parse as JSON first (for structured responses)
    try {
      const parsed = JSON.parse(llmResponse);
      return {
        text: parsed.response || parsed.text || llmResponse,
        intent: parsed.intent,
        actions: parsed.actions,
        confidence: parsed.confidence,
        metadata: parsed.metadata
      };
    } catch {
      // Plain text response
      return { text: llmResponse };
    }
  }
  
  // Provider factory methods
  
  private async createSTTProvider(config: STTConfig): Promise<STTProvider> {
    if (config.customProvider) {
      return config.customProvider;
    }
    
    switch (config.provider) {
      case 'deepgram':
        const { DeepgramSTTProvider } = await import('./providers/deepgram');
        return new DeepgramSTTProvider(config);
      case 'whisper':
        const { WhisperSTTProvider } = await import('./providers/whisper');
        return new WhisperSTTProvider(config);
      case 'browser':
        const { BrowserSTTProvider } = await import('./providers/browser-stt');
        return new BrowserSTTProvider(config);
      default:
        throw new Error(`Unknown STT provider: ${config.provider}`);
    }
  }
  
  private async createLLMProvider(config: LLMConfig): Promise<LLMProvider> {
    if (config.customProvider) {
      return config.customProvider;
    }
    
    switch (config.provider) {
      case 'groq':
        const { GroqLLMProvider } = await import('./providers/groq');
        return new GroqLLMProvider(config);
      case 'openai':
        const { OpenAILLMProvider } = await import('./providers/openai');
        return new OpenAILLMProvider(config);
      case 'ollama':
        const { OllamaLLMProvider } = await import('./providers/ollama');
        return new OllamaLLMProvider(config);
      default:
        throw new Error(`Unknown LLM provider: ${config.provider}`);
    }
  }
  
  private async createTTSProvider(config: TTSConfig): Promise<TTSProvider> {
    if (config.customProvider) {
      return config.customProvider;
    }
    
    switch (config.provider) {
      case 'edge-tts':
        const { EdgeTTSProvider } = await import('./providers/edge-tts');
        return new EdgeTTSProvider(config);
      case 'elevenlabs':
        const { ElevenLabsTTSProvider } = await import('./providers/elevenlabs');
        return new ElevenLabsTTSProvider(config);
      case 'browser':
        const { BrowserTTSProvider } = await import('./providers/browser-tts');
        return new BrowserTTSProvider(config);
      default:
        throw new Error(`Unknown TTS provider: ${config.provider}`);
    }
  }
}
```

---

## Provider Interfaces

### STT Provider

```typescript
// providers/stt-provider.ts

export interface STTProvider {
  name: string;
  
  /**
   * Initialize the provider
   */
  initialize(): Promise<void>;
  
  /**
   * Start listening
   */
  start(): Promise<void>;
  
  /**
   * Stop listening
   */
  stop(): Promise<void>;
  
  /**
   * Process audio chunk (for streaming)
   */
  processAudio?(chunk: ArrayBuffer): void;
  
  /**
   * Register transcript callback
   */
  onTranscript(callback: (transcript: Transcript) => void): void;
  
  /**
   * Register error callback
   */
  onError(callback: (error: Error) => void): void;
  
  /**
   * Clean up resources
   */
  destroy(): Promise<void>;
}
```

### LLM Provider

```typescript
// providers/llm-provider.ts

export interface LLMRequest {
  messages: Message[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface LLMProvider {
  name: string;
  
  /**
   * Initialize the provider
   */
  initialize(): Promise<void>;
  
  /**
   * Generate a response
   */
  generate(request: LLMRequest): Promise<string>;
  
  /**
   * Generate a streaming response
   */
  generateStream?(request: LLMRequest): AsyncGenerator<string>;
  
  /**
   * Generate with tool calling
   */
  generateWithTools?(
    request: LLMRequest,
    tools: ToolDefinition[]
  ): Promise<LLMResponseWithTools>;
  
  /**
   * Clean up resources
   */
  destroy(): Promise<void>;
}
```

### TTS Provider

```typescript
// providers/tts-provider.ts

export interface Voice {
  id: string;
  name: string;
  language: string;
  gender?: 'male' | 'female' | 'neutral';
}

export interface TTSProvider {
  name: string;
  
  /**
   * Initialize the provider
   */
  initialize(): Promise<void>;
  
  /**
   * Get available voices
   */
  getVoices(): Promise<Voice[]>;
  
  /**
   * Synthesize text to audio
   */
  synthesize(text: string, voice?: string): Promise<ArrayBuffer>;
  
  /**
   * Synthesize text to streaming audio
   */
  synthesizeStream(text: string, voice?: string): AsyncGenerator<ArrayBuffer>;
  
  /**
   * Clean up resources
   */
  destroy(): Promise<void>;
}
```

---

## Usage Examples

### Basic Usage

```typescript
import { VoiceAgent } from '@sahayak/voice-agent-core';

const agent = new VoiceAgent({
  stt: { provider: 'deepgram', apiKey: process.env.DEEPGRAM_API_KEY },
  llm: { provider: 'groq', apiKey: process.env.GROQ_API_KEY },
  tts: { provider: 'edge-tts' },
  systemPrompt: 'You are a helpful assistant.'
});

await agent.initialize();

agent.on('transcript', (t) => console.log('User:', t.text));
agent.on('response', (r) => console.log('Assistant:', r.text));

await agent.start();
```

### With Actions

```typescript
const agent = new VoiceAgent({
  stt: { provider: 'deepgram', apiKey: 'xxx' },
  llm: { provider: 'groq', apiKey: 'xxx' },
  tts: { provider: 'edge-tts' },
  actions: [
    {
      type: 'navigate',
      handle: async (action) => {
        window.location.href = action.params.url;
        return { success: true };
      }
    },
    {
      type: 'search',
      handle: async (action) => {
        const results = await search(action.params.query);
        return { success: true, data: results };
      }
    }
  ]
});
```

### Custom Provider

```typescript
import { VoiceAgent, STTProvider } from '@sahayak/voice-agent-core';

class MyCustomSTTProvider implements STTProvider {
  name = 'my-custom-stt';
  
  async initialize() {
    // Setup
  }
  
  async start() {
    // Start listening
  }
  
  async stop() {
    // Stop listening
  }
  
  onTranscript(callback) {
    this.transcriptCallback = callback;
  }
  
  onError(callback) {
    this.errorCallback = callback;
  }
  
  async destroy() {
    // Cleanup
  }
}

const agent = new VoiceAgent({
  stt: { provider: 'custom', customProvider: new MyCustomSTTProvider() },
  llm: { provider: 'groq', apiKey: 'xxx' },
  tts: { provider: 'edge-tts' }
});
```

---

## Package Structure

```
@sahayak/voice-agent-core/
├── src/
│   ├── index.ts              # Main exports
│   ├── VoiceAgent.ts         # Core VoiceAgent class
│   ├── types.ts              # TypeScript types
│   ├── providers/
│   │   ├── index.ts
│   │   ├── stt/
│   │   │   ├── STTProvider.ts
│   │   │   ├── DeepgramSTTProvider.ts
│   │   │   ├── WhisperSTTProvider.ts
│   │   │   └── BrowserSTTProvider.ts
│   │   ├── llm/
│   │   │   ├── LLMProvider.ts
│   │   │   ├── GroqLLMProvider.ts
│   │   │   ├── OpenAILLMProvider.ts
│   │   │   └── OllamaLLMProvider.ts
│   │   └── tts/
│   │       ├── TTSProvider.ts
│   │       ├── EdgeTTSProvider.ts
│   │       ├── ElevenLabsTTSProvider.ts
│   │       └── BrowserTTSProvider.ts
│   └── utils/
│       ├── audio.ts          # Audio utilities
│       ├── websocket.ts      # WebSocket utilities
│       └── logger.ts         # Logging
├── dist/                     # Built files
├── package.json
├── tsconfig.json
└── README.md
```

---

## Publishing

### npm Package

```json
{
  "name": "@sahayak/voice-agent-core",
  "version": "0.1.0",
  "description": "Core voice agent library for building conversational AI applications",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./providers/*": {
      "import": "./dist/providers/*.mjs",
      "require": "./dist/providers/*.js"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "test": "vitest",
    "lint": "eslint src",
    "prepublishOnly": "npm run build"
  },
  "keywords": [
    "voice",
    "agent",
    "stt",
    "tts",
    "llm",
    "ai",
    "conversational"
  ],
  "author": "Sahayak Team",
  "license": "MIT",
  "peerDependencies": {
    "typescript": ">=4.7.0"
  }
}
```

### Build Configuration

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  minify: true,
  treeshake: true,
  external: ['ws']
});
```
