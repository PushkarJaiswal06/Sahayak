# Streaming STT Protocol

## Overview

This document defines the streaming Speech-to-Text protocol for real-time voice processing. The protocol is designed to be provider-agnostic and can be implemented over WebSocket, WebRTC, or HTTP/2.

---

## Protocol Specification

### Version

Protocol Version: 1.0

### Transport

The primary transport is WebSocket, with HTTP/2 streaming as fallback.

---

## Message Format

All messages use JSON encoding with the following base structure:

```typescript
interface Message {
  type: string;
  timestamp: number;
  sequence: number;
  payload: any;
}
```

---

## Connection Lifecycle

### 1. Connection Establishment

```
Client                                    Server
  |                                         |
  |  ────── WebSocket Connection ────────► |
  |                                         |
  |  ◄────── CONNECTION_ACK ──────────────  |
  |                                         |
  |  ────── CONFIGURE ────────────────────► |
  |                                         |
  |  ◄────── CONFIGURE_ACK ───────────────  |
  |                                         |
  |  ────── START_STREAM ─────────────────► |
  |                                         |
  |  ◄────── STREAM_STARTED ──────────────  |
  |                                         |
```

### 2. Active Streaming

```
Client                                    Server
  |                                         |
  |  ────── AUDIO_CHUNK ──────────────────► |
  |  ────── AUDIO_CHUNK ──────────────────► |
  |                                         |
  |  ◄────── TRANSCRIPT (interim) ────────  |
  |                                         |
  |  ────── AUDIO_CHUNK ──────────────────► |
  |  ────── AUDIO_CHUNK ──────────────────► |
  |                                         |
  |  ◄────── TRANSCRIPT (interim) ────────  |
  |                                         |
  |  ────── AUDIO_CHUNK ──────────────────► |
  |  ────── AUDIO_CHUNK ──────────────────► |
  |                                         |
  |  ◄────── TRANSCRIPT (final) ──────────  |
  |                                         |
```

### 3. Connection Termination

```
Client                                    Server
  |                                         |
  |  ────── STOP_STREAM ──────────────────► |
  |                                         |
  |  ◄────── STREAM_STOPPED ──────────────  |
  |                                         |
  |  ────── CLOSE ────────────────────────► |
  |                                         |
  |  ◄────── CLOSE_ACK ───────────────────  |
  |                                         |
```

---

## Message Types

### Client Messages

#### CONFIGURE

Sent to configure the STT session.

```typescript
interface ConfigureMessage {
  type: 'CONFIGURE';
  timestamp: number;
  sequence: number;
  payload: {
    language: string;           // BCP-47 language code
    model?: string;             // Model to use
    sampleRate: number;         // Audio sample rate (default: 16000)
    channels: number;           // Number of audio channels (default: 1)
    encoding: AudioEncoding;    // Audio encoding format
    interimResults: boolean;    // Whether to send interim results
    punctuate?: boolean;        // Add punctuation
    profanityFilter?: boolean;  // Filter profanity
    keywords?: string[];        // Boost specific keywords
    endpointing?: number;       // Silence duration for endpoint detection (ms)
    utteranceEndMs?: number;    // Utterance end detection threshold
    vadTurnoff?: number;        // VAD turnoff threshold
    multichannel?: boolean;     // Process channels independently
    diarize?: boolean;          // Enable speaker diarization
    maxSpeakers?: number;       // Maximum number of speakers for diarization
  };
}

type AudioEncoding = 
  | 'LINEAR16'    // Raw PCM 16-bit signed little-endian
  | 'FLAC'        // FLAC encoded
  | 'MULAW'       // mu-law encoded
  | 'AMR'         // AMR encoded
  | 'AMR_WB'      // AMR-WB encoded
  | 'OGG_OPUS'    // Ogg Opus encoded
  | 'WEBM_OPUS'   // WebM Opus encoded
  | 'MP3';        // MP3 encoded
```

#### START_STREAM

Initiates the audio stream.

```typescript
interface StartStreamMessage {
  type: 'START_STREAM';
  timestamp: number;
  sequence: number;
  payload: {
    streamId?: string;  // Optional client-provided stream ID
    metadata?: Record<string, any>;  // Custom metadata
  };
}
```

#### AUDIO_CHUNK

Sends audio data. This is sent as a binary message.

```typescript
// Binary frame format:
// Bytes 0-3: Sequence number (uint32, big-endian)
// Bytes 4-11: Timestamp (uint64, big-endian) - microseconds
// Bytes 12+: Audio data

// Or as JSON for testing/debugging:
interface AudioChunkMessage {
  type: 'AUDIO_CHUNK';
  timestamp: number;
  sequence: number;
  payload: {
    data: string;     // Base64-encoded audio data
    duration: number; // Duration in milliseconds
  };
}
```

#### STOP_STREAM

Stops the audio stream.

```typescript
interface StopStreamMessage {
  type: 'STOP_STREAM';
  timestamp: number;
  sequence: number;
  payload: {
    finalize: boolean;  // Whether to process remaining audio
  };
}
```

#### PING

Keep-alive message.

```typescript
interface PingMessage {
  type: 'PING';
  timestamp: number;
  sequence: number;
  payload: null;
}
```

### Server Messages

#### CONNECTION_ACK

Acknowledges connection establishment.

```typescript
interface ConnectionAckMessage {
  type: 'CONNECTION_ACK';
  timestamp: number;
  sequence: number;
  payload: {
    sessionId: string;
    serverVersion: string;
    supportedEncodings: AudioEncoding[];
    supportedLanguages: string[];
    maxAudioChunkSize: number;
    maxStreamDuration: number;  // Maximum stream duration in seconds
  };
}
```

#### CONFIGURE_ACK

Acknowledges configuration.

```typescript
interface ConfigureAckMessage {
  type: 'CONFIGURE_ACK';
  timestamp: number;
  sequence: number;
  payload: {
    success: boolean;
    effectiveConfig: {
      language: string;
      model: string;
      sampleRate: number;
      // ... resolved configuration
    };
  };
}
```

#### STREAM_STARTED

Confirms stream start.

```typescript
interface StreamStartedMessage {
  type: 'STREAM_STARTED';
  timestamp: number;
  sequence: number;
  payload: {
    streamId: string;
    startTimestamp: number;
  };
}
```

#### TRANSCRIPT

Speech-to-text result.

```typescript
interface TranscriptMessage {
  type: 'TRANSCRIPT';
  timestamp: number;
  sequence: number;
  payload: {
    streamId: string;
    channel?: number;           // Channel index (for multichannel)
    isFinal: boolean;           // Whether this is a final result
    text: string;               // Full transcript text
    confidence: number;         // Overall confidence (0-1)
    words?: TranscriptWord[];   // Word-level details
    alternatives?: TranscriptAlternative[];  // Alternative transcriptions
    startTime: number;          // Start time in audio (ms)
    endTime: number;            // End time in audio (ms)
    speaker?: number;           // Speaker ID (if diarization enabled)
    speechFinal?: boolean;      // End of speech segment
  };
}

interface TranscriptWord {
  word: string;
  startTime: number;      // Start time in audio (ms)
  endTime: number;        // End time in audio (ms)
  confidence: number;     // Word confidence (0-1)
  punctuatedWord?: string;  // Word with punctuation
}

interface TranscriptAlternative {
  text: string;
  confidence: number;
  words?: TranscriptWord[];
}
```

#### SPEECH_STARTED

Indicates speech has been detected.

```typescript
interface SpeechStartedMessage {
  type: 'SPEECH_STARTED';
  timestamp: number;
  sequence: number;
  payload: {
    streamId: string;
    startTimestamp: number;  // Audio timestamp where speech started
  };
}
```

#### SPEECH_ENDED

Indicates speech has ended (silence detected).

```typescript
interface SpeechEndedMessage {
  type: 'SPEECH_ENDED';
  timestamp: number;
  sequence: number;
  payload: {
    streamId: string;
    endTimestamp: number;  // Audio timestamp where speech ended
    duration: number;      // Speech duration in milliseconds
  };
}
```

#### UTTERANCE_END

Indicates an utterance boundary.

```typescript
interface UtteranceEndMessage {
  type: 'UTTERANCE_END';
  timestamp: number;
  sequence: number;
  payload: {
    streamId: string;
    utteranceId: string;
    transcript: string;
    startTime: number;
    endTime: number;
  };
}
```

#### ERROR

Error notification.

```typescript
interface ErrorMessage {
  type: 'ERROR';
  timestamp: number;
  sequence: number;
  payload: {
    code: ErrorCode;
    message: string;
    details?: any;
    recoverable: boolean;
  };
}

enum ErrorCode {
  INVALID_MESSAGE = 1000,
  INVALID_AUDIO_FORMAT = 1001,
  UNSUPPORTED_LANGUAGE = 1002,
  UNSUPPORTED_ENCODING = 1003,
  STREAM_LIMIT_EXCEEDED = 1004,
  AUDIO_TOO_LONG = 1005,
  AUDIO_TOO_SHORT = 1006,
  RATE_LIMITED = 1007,
  AUTHENTICATION_FAILED = 2000,
  AUTHORIZATION_FAILED = 2001,
  QUOTA_EXCEEDED = 2002,
  INTERNAL_ERROR = 5000,
  SERVICE_UNAVAILABLE = 5001,
}
```

#### PONG

Response to PING.

```typescript
interface PongMessage {
  type: 'PONG';
  timestamp: number;
  sequence: number;
  payload: {
    latency: number;  // Server-measured latency in ms
  };
}
```

---

## Audio Format Recommendations

### Preferred Format

- **Encoding**: LINEAR16 (raw PCM)
- **Sample Rate**: 16000 Hz
- **Channels**: 1 (mono)
- **Bit Depth**: 16-bit
- **Byte Order**: Little-endian

### Chunk Size

- **Recommended**: 100ms of audio per chunk
- **At 16kHz**: 3200 bytes per chunk
- **Minimum**: 20ms (640 bytes)
- **Maximum**: 250ms (8000 bytes)

### Audio Processing

```typescript
// Client-side audio processing with AudioWorklet
class STTAudioProcessor extends AudioWorkletProcessor {
  private buffer: Float32Array[] = [];
  private readonly CHUNK_SIZE = 3200; // 100ms at 16kHz
  
  process(inputs: Float32Array[][], outputs: Float32Array[][], params: Record<string, Float32Array>) {
    const input = inputs[0];
    if (input.length === 0) return true;
    
    // Convert to 16-bit PCM
    const samples = input[0];
    const pcm = new Int16Array(samples.length);
    
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Accumulate and send chunks
    this.buffer.push(pcm);
    
    if (this.getBufferSize() >= this.CHUNK_SIZE) {
      this.port.postMessage({
        type: 'audio',
        data: this.flushBuffer()
      });
    }
    
    return true;
  }
}
```

---

## Client Implementation

### TypeScript Client

```typescript
class StreamingSTTClient {
  private ws: WebSocket;
  private sequence = 0;
  private streamId: string | null = null;
  private readonly url: string;
  private readonly config: STTConfig;
  
  constructor(url: string, config: STTConfig) {
    this.url = url;
    this.config = config;
  }
  
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        // Wait for CONNECTION_ACK
      };
      
      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      };
      
      this.ws.onerror = reject;
    });
  }
  
  async configure(): Promise<void> {
    this.send({
      type: 'CONFIGURE',
      timestamp: Date.now(),
      sequence: this.sequence++,
      payload: this.config
    });
    
    return this.waitFor('CONFIGURE_ACK');
  }
  
  async startStream(): Promise<string> {
    this.send({
      type: 'START_STREAM',
      timestamp: Date.now(),
      sequence: this.sequence++,
      payload: {}
    });
    
    const response = await this.waitFor('STREAM_STARTED');
    this.streamId = response.payload.streamId;
    return this.streamId;
  }
  
  sendAudio(chunk: ArrayBuffer): void {
    if (!this.streamId) throw new Error('Stream not started');
    
    // Send binary frame with header
    const header = new ArrayBuffer(12);
    const view = new DataView(header);
    view.setUint32(0, this.sequence++, false);
    view.setBigUint64(4, BigInt(Date.now() * 1000), false);
    
    const message = new Uint8Array(12 + chunk.byteLength);
    message.set(new Uint8Array(header), 0);
    message.set(new Uint8Array(chunk), 12);
    
    this.ws.send(message);
  }
  
  async stopStream(): Promise<void> {
    this.send({
      type: 'STOP_STREAM',
      timestamp: Date.now(),
      sequence: this.sequence++,
      payload: { finalize: true }
    });
    
    await this.waitFor('STREAM_STOPPED');
    this.streamId = null;
  }
  
  onTranscript(callback: (transcript: Transcript) => void): void {
    this.transcriptCallback = callback;
  }
  
  private send(message: any): void {
    this.ws.send(JSON.stringify(message));
  }
  
  private handleMessage(message: any): void {
    switch (message.type) {
      case 'TRANSCRIPT':
        if (this.transcriptCallback) {
          this.transcriptCallback(message.payload);
        }
        break;
      case 'ERROR':
        this.emit('error', message.payload);
        break;
      // ... handle other message types
    }
  }
}
```

---

## Server Implementation

### Python (FastAPI) Server

```python
from fastapi import FastAPI, WebSocket
import json
import uuid
from datetime import datetime
from dataclasses import dataclass
from typing import Optional, List

@dataclass
class STTSession:
    session_id: str
    config: dict
    stream_id: Optional[str] = None
    sequence: int = 0

app = FastAPI()

@app.websocket("/stt/stream")
async def stt_stream(websocket: WebSocket):
    await websocket.accept()
    
    session = STTSession(
        session_id=str(uuid.uuid4()),
        config={}
    )
    
    # Send CONNECTION_ACK
    await websocket.send_json({
        "type": "CONNECTION_ACK",
        "timestamp": int(datetime.now().timestamp() * 1000),
        "sequence": session.sequence,
        "payload": {
            "sessionId": session.session_id,
            "serverVersion": "1.0.0",
            "supportedEncodings": ["LINEAR16", "WEBM_OPUS"],
            "supportedLanguages": ["en-US", "en-GB", "es-ES"],
            "maxAudioChunkSize": 8000,
            "maxStreamDuration": 3600
        }
    })
    session.sequence += 1
    
    try:
        while True:
            data = await websocket.receive()
            
            if "text" in data:
                message = json.loads(data["text"])
                await handle_json_message(websocket, session, message)
            elif "bytes" in data:
                await handle_audio_chunk(websocket, session, data["bytes"])
                
    except Exception as e:
        await websocket.send_json({
            "type": "ERROR",
            "timestamp": int(datetime.now().timestamp() * 1000),
            "sequence": session.sequence,
            "payload": {
                "code": 5000,
                "message": str(e),
                "recoverable": False
            }
        })

async def handle_json_message(ws, session, message):
    msg_type = message.get("type")
    
    if msg_type == "CONFIGURE":
        session.config = message["payload"]
        await ws.send_json({
            "type": "CONFIGURE_ACK",
            "timestamp": int(datetime.now().timestamp() * 1000),
            "sequence": session.sequence,
            "payload": {
                "success": True,
                "effectiveConfig": session.config
            }
        })
        session.sequence += 1
        
    elif msg_type == "START_STREAM":
        session.stream_id = str(uuid.uuid4())
        await ws.send_json({
            "type": "STREAM_STARTED",
            "timestamp": int(datetime.now().timestamp() * 1000),
            "sequence": session.sequence,
            "payload": {
                "streamId": session.stream_id,
                "startTimestamp": int(datetime.now().timestamp() * 1000)
            }
        })
        session.sequence += 1
        
    elif msg_type == "STOP_STREAM":
        session.stream_id = None
        await ws.send_json({
            "type": "STREAM_STOPPED",
            "timestamp": int(datetime.now().timestamp() * 1000),
            "sequence": session.sequence,
            "payload": {}
        })
        session.sequence += 1

async def handle_audio_chunk(ws, session, audio_data: bytes):
    # Parse header
    sequence = int.from_bytes(audio_data[0:4], 'big')
    timestamp = int.from_bytes(audio_data[4:12], 'big')
    audio = audio_data[12:]
    
    # Process audio with STT engine
    transcript = await process_audio(audio, session.config)
    
    if transcript:
        await ws.send_json({
            "type": "TRANSCRIPT",
            "timestamp": int(datetime.now().timestamp() * 1000),
            "sequence": session.sequence,
            "payload": transcript
        })
        session.sequence += 1
```

---

## Security Considerations

### Authentication

- Use JWT tokens in WebSocket URL query parameter or initial message
- Validate tokens on connection
- Support token refresh without reconnection

### Rate Limiting

- Limit connections per client
- Limit audio duration per stream
- Limit total audio per time window

### Data Protection

- Use WSS (WebSocket Secure) in production
- Don't log audio data
- Implement data retention policies

---

## Compatibility Matrix

| Provider | Protocol Support | Notes |
|----------|-----------------|-------|
| Deepgram | Full | Native WebSocket API |
| Google Cloud | Partial | gRPC preferred |
| AWS Transcribe | Full | Uses HTTP/2 streaming |
| Azure Speech | Full | WebSocket API |
| OpenAI Whisper | Server-side only | No streaming API |
| Local Whisper | Via adapter | Requires chunking |
