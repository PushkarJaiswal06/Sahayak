# Technical Architecture

## Overview

This document describes the technical architecture of the Sahayak Voice Agent that will be abstracted for open source contribution.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Browser   │  │   Mobile    │  │   Desktop   │  │    CLI      │        │
│  │   (React)   │  │   (RN)      │  │  (Electron) │  │   (Node)    │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                   │                                          │
│                    ┌──────────────▼──────────────┐                          │
│                    │    Voice Agent SDK          │                          │
│                    │  ┌────────────────────────┐ │                          │
│                    │  │  Audio Capture Module  │ │                          │
│                    │  │  WebSocket Transport   │ │                          │
│                    │  │  Event Handler         │ │                          │
│                    │  └────────────────────────┘ │                          │
│                    └──────────────┬──────────────┘                          │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │
                          WebSocket │ (Audio Streaming)
                                    │
┌───────────────────────────────────┼─────────────────────────────────────────┐
│                              SERVER LAYER                                    │
├───────────────────────────────────┼─────────────────────────────────────────┤
│                    ┌──────────────▼──────────────┐                          │
│                    │    Agent Orchestrator       │                          │
│                    │  ┌────────────────────────┐ │                          │
│                    │  │  Connection Manager    │ │                          │
│                    │  │  Audio Buffer          │ │                          │
│                    │  │  Pipeline Controller   │ │                          │
│                    │  └────────────────────────┘ │                          │
│                    └──────────────┬──────────────┘                          │
│                                   │                                          │
│         ┌─────────────────────────┼─────────────────────────────┐           │
│         │                         │                             │           │
│         ▼                         ▼                             ▼           │
│  ┌─────────────┐          ┌─────────────┐              ┌─────────────┐      │
│  │ STT Service │          │ LLM Service │              │ TTS Service │      │
│  │             │          │             │              │             │      │
│  │ - Deepgram  │          │ - Groq      │              │ - Edge TTS  │      │
│  │ - Whisper   │          │ - OpenAI    │              │ - ElevenLabs│      │
│  │ - Google    │          │ - Anthropic │              │ - Google    │      │
│  └─────────────┘          └─────────────┘              └─────────────┘      │
│                                   │                                          │
│                    ┌──────────────▼──────────────┐                          │
│                    │    Action Dispatcher        │                          │
│                    │  ┌────────────────────────┐ │                          │
│                    │  │  Action Registry       │ │                          │
│                    │  │  Permission Checker    │ │                          │
│                    │  │  Execution Engine      │ │                          │
│                    │  └────────────────────────┘ │                          │
│                    └─────────────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Component Breakdown

### 1. Voice Agent SDK (Client)

```typescript
// @sahayak/voice-sdk

/**
 * Main entry point for voice agent functionality
 */
export class VoiceAgentClient {
  private audioContext: AudioContext;
  private mediaStream: MediaStream;
  private websocket: WebSocket;
  private audioWorklet: AudioWorkletNode;
  
  constructor(config: VoiceAgentConfig) {
    this.config = config;
  }
  
  /**
   * Initialize audio capture and WebSocket connection
   */
  async connect(): Promise<void> {
    // 1. Get microphone permission
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      }
    });
    
    // 2. Setup AudioWorklet for processing
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    await this.audioContext.audioWorklet.addModule('/audio-processor.js');
    
    // 3. Connect to server
    this.websocket = new WebSocket(this.config.serverUrl);
    this.setupWebSocketHandlers();
  }
  
  /**
   * Start voice capture and streaming
   */
  start(): void {
    this.audioWorklet.port.postMessage({ command: 'start' });
  }
  
  /**
   * Stop voice capture
   */
  stop(): void {
    this.audioWorklet.port.postMessage({ command: 'stop' });
  }
}
```

### 2. Audio Processor (Web Worker)

```javascript
// audio-processor.js (AudioWorkletProcessor)

class VoiceAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = false;
    this.buffer = [];
    this.bufferSize = 4096; // ~256ms at 16kHz
    
    this.port.onmessage = (event) => {
      if (event.data.command === 'start') {
        this.isRecording = true;
      } else if (event.data.command === 'stop') {
        this.isRecording = false;
        this.flush();
      }
    };
  }
  
  process(inputs, outputs, parameters) {
    if (!this.isRecording) return true;
    
    const input = inputs[0][0]; // Mono channel
    if (input) {
      // Convert Float32 to Int16 for transmission
      const int16 = this.float32ToInt16(input);
      this.buffer.push(...int16);
      
      // Send when buffer is full
      if (this.buffer.length >= this.bufferSize) {
        this.port.postMessage({
          type: 'audio',
          data: new Int16Array(this.buffer)
        });
        this.buffer = [];
      }
    }
    
    return true;
  }
  
  float32ToInt16(float32Array) {
    const int16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
  }
}

registerProcessor('voice-audio-processor', VoiceAudioProcessor);
```

### 3. Agent Orchestrator (Server)

```python
# agent_orchestrator.py

from typing import AsyncGenerator
from dataclasses import dataclass
from enum import Enum

class AgentState(Enum):
    IDLE = "idle"
    LISTENING = "listening"
    PROCESSING = "processing"
    SPEAKING = "speaking"

@dataclass
class ConversationContext:
    user_id: str
    session_id: str
    messages: list[dict]
    entities: dict
    current_intent: str | None

class AgentOrchestrator:
    """
    Core orchestration engine for voice agent pipeline
    """
    
    def __init__(
        self,
        stt_service: STTService,
        llm_service: LLMService,
        tts_service: TTSService,
        action_dispatcher: ActionDispatcher,
    ):
        self.stt = stt_service
        self.llm = llm_service
        self.tts = tts_service
        self.actions = action_dispatcher
        self.state = AgentState.IDLE
        self.context = None
    
    async def process_audio_stream(
        self,
        audio_stream: AsyncGenerator[bytes, None],
        websocket: WebSocket,
    ) -> None:
        """
        Main processing pipeline for incoming audio
        """
        self.state = AgentState.LISTENING
        
        # 1. Stream audio to STT service
        async for transcript in self.stt.transcribe_stream(audio_stream):
            # Send interim transcripts to client
            await websocket.send_json({
                "type": "transcript",
                "text": transcript.text,
                "is_final": transcript.is_final,
            })
            
            if transcript.is_final:
                await self._process_utterance(transcript.text, websocket)
    
    async def _process_utterance(
        self,
        text: str,
        websocket: WebSocket,
    ) -> None:
        """
        Process a complete user utterance
        """
        self.state = AgentState.PROCESSING
        
        # 2. Generate response with LLM
        self.context.messages.append({"role": "user", "content": text})
        
        response = await self.llm.generate(
            messages=self.context.messages,
            system_prompt=self._build_system_prompt(),
        )
        
        # 3. Parse action plan from response
        action_plan = self._parse_action_plan(response)
        
        # 4. Generate TTS audio
        self.state = AgentState.SPEAKING
        audio_chunks = self.tts.synthesize_stream(action_plan.response_text)
        
        async for chunk in audio_chunks:
            await websocket.send_bytes(chunk)
        
        # 5. Execute actions
        if action_plan.actions:
            await self._execute_actions(action_plan.actions, websocket)
        
        self.state = AgentState.IDLE
```

### 4. Action Plan Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "VoiceAgentActionPlan",
  "type": "object",
  "properties": {
    "response_text": {
      "type": "string",
      "description": "Text to speak to the user"
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Confidence score for the response"
    },
    "intent": {
      "type": "string",
      "description": "Detected user intent"
    },
    "entities": {
      "type": "object",
      "description": "Extracted entities from user input"
    },
    "actions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "enum": ["navigate", "click", "fill", "api_call", "custom"]
          },
          "target": {
            "type": "string",
            "description": "Target element or endpoint"
          },
          "params": {
            "type": "object",
            "description": "Action-specific parameters"
          },
          "confirmation_required": {
            "type": "boolean",
            "default": false
          }
        },
        "required": ["type"]
      }
    },
    "context_update": {
      "type": "object",
      "description": "Updates to conversation context"
    }
  },
  "required": ["response_text"]
}
```

---

## 🔌 Provider Abstraction

### STT Provider Interface

```typescript
interface STTProvider {
  name: string;
  
  // Initialize connection
  connect(config: STTConfig): Promise<void>;
  
  // Stream audio and get transcripts
  transcribe(audioChunk: ArrayBuffer): void;
  
  // Events
  onTranscript: (callback: (transcript: Transcript) => void) => void;
  onError: (callback: (error: Error) => void) => void;
  
  // Cleanup
  disconnect(): Promise<void>;
}

// Implementations
class DeepgramSTTProvider implements STTProvider { ... }
class WhisperSTTProvider implements STTProvider { ... }
class BrowserSTTProvider implements STTProvider { ... }
class GoogleSTTProvider implements STTProvider { ... }
```

### LLM Provider Interface

```typescript
interface LLMProvider {
  name: string;
  
  // Generate response
  generate(request: LLMRequest): Promise<LLMResponse>;
  
  // Stream response
  generateStream(request: LLMRequest): AsyncGenerator<string>;
  
  // Function calling
  generateWithTools(
    request: LLMRequest,
    tools: ToolDefinition[]
  ): Promise<LLMResponseWithTools>;
}

// Implementations
class GroqLLMProvider implements LLMProvider { ... }
class OpenAILLMProvider implements LLMProvider { ... }
class AnthropicLLMProvider implements LLMProvider { ... }
class OllamaLLMProvider implements LLMProvider { ... }
```

### TTS Provider Interface

```typescript
interface TTSProvider {
  name: string;
  voices: Voice[];
  
  // Synthesize text to audio
  synthesize(text: string, voice?: string): Promise<ArrayBuffer>;
  
  // Stream synthesis
  synthesizeStream(text: string, voice?: string): AsyncGenerator<ArrayBuffer>;
  
  // Get available voices
  getVoices(): Promise<Voice[]>;
}

// Implementations
class EdgeTTSProvider implements TTSProvider { ... }
class ElevenLabsTTSProvider implements TTSProvider { ... }
class BrowserTTSProvider implements TTSProvider { ... }
class GoogleTTSProvider implements TTSProvider { ... }
```

---

## 🔒 Security Architecture

### Permission Model

```typescript
enum VoiceAgentPermission {
  MICROPHONE = 'microphone',        // Audio capture
  SPEAKER = 'speaker',              // Audio playback
  NAVIGATION = 'navigation',        // Page navigation
  DOM_INTERACTION = 'dom',          // Click, fill, etc.
  CLIPBOARD = 'clipboard',          // Copy/paste
  NOTIFICATIONS = 'notifications',   // Show notifications
  STORAGE = 'storage',              // Local storage
  NETWORK = 'network',              // API calls
}

interface PermissionRequest {
  permission: VoiceAgentPermission;
  reason: string;
  temporary: boolean;
}

class PermissionManager {
  async request(permissions: PermissionRequest[]): Promise<PermissionStatus[]>;
  async check(permission: VoiceAgentPermission): Promise<PermissionStatus>;
  async revoke(permission: VoiceAgentPermission): Promise<void>;
}
```

### Data Flow Security

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY BOUNDARIES                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    TLS 1.3    ┌─────────────────┐          │
│  │     Client      │◄─────────────►│     Server      │          │
│  │                 │               │                 │          │
│  │ - Audio encrypt │               │ - Audio decrypt │          │
│  │ - Token auth    │               │ - JWT validate  │          │
│  │ - CSP headers   │               │ - Rate limit    │          │
│  └─────────────────┘               └─────────────────┘          │
│                                           │                      │
│                                           ▼                      │
│                              ┌─────────────────┐                │
│                              │  AI Providers   │                │
│                              │                 │                │
│                              │ - PII redaction │                │
│                              │ - Audit logging │                │
│                              │ - No storage    │                │
│                              └─────────────────┘                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Performance Characteristics

| Metric | Target | Achieved |
|--------|--------|----------|
| Audio latency (capture → server) | < 100ms | 80ms |
| STT latency (audio → text) | < 300ms | 250ms |
| LLM latency (text → response) | < 500ms | 400ms |
| TTS latency (text → audio) | < 200ms | 150ms |
| **Total round-trip** | < 1.5s | 1.2s |
| Memory usage (client) | < 50MB | 35MB |
| CPU usage (idle) | < 1% | 0.5% |
| CPU usage (active) | < 15% | 10% |

---

## 🔄 State Machine

```
                    ┌─────────────────┐
                    │                 │
           ┌───────►│      IDLE       │◄──────┐
           │        │                 │       │
           │        └────────┬────────┘       │
           │                 │                │
           │          start()│                │
           │                 ▼                │
           │        ┌─────────────────┐       │
           │        │                 │       │
    stop() │        │    LISTENING    │       │ response
           │        │                 │       │ complete
           │        └────────┬────────┘       │
           │                 │                │
           │       transcript│                │
           │         is_final│                │
           │                 ▼                │
           │        ┌─────────────────┐       │
           │        │                 │       │
           ├────────│   PROCESSING    │       │
           │        │                 │       │
           │        └────────┬────────┘       │
           │                 │                │
           │       response  │                │
           │        ready    │                │
           │                 ▼                │
           │        ┌─────────────────┐       │
           │        │                 │       │
           └────────│    SPEAKING     │───────┘
                    │                 │
                    └─────────────────┘
```

---

## 📁 Package Structure

```
@sahayak/voice-agent/
├── packages/
│   ├── core/                    # Core abstractions
│   │   ├── src/
│   │   │   ├── agent.ts
│   │   │   ├── providers/
│   │   │   ├── actions/
│   │   │   └── utils/
│   │   └── package.json
│   │
│   ├── client/                  # Browser/Node client
│   │   ├── src/
│   │   │   ├── audio-capture.ts
│   │   │   ├── websocket.ts
│   │   │   └── ui-components/
│   │   └── package.json
│   │
│   ├── server/                  # Server implementation
│   │   ├── src/
│   │   │   ├── orchestrator.ts
│   │   │   ├── handlers/
│   │   │   └── middleware/
│   │   └── package.json
│   │
│   └── providers/               # Provider implementations
│       ├── deepgram/
│       ├── groq/
│       ├── edge-tts/
│       └── package.json
│
├── examples/
│   ├── browser-demo/
│   ├── electron-app/
│   └── nodejs-cli/
│
└── docs/
    ├── api/
    ├── guides/
    └── examples/
```
