# Node.js Voice Agent SDK

A Node.js SDK for building voice-enabled applications and server-side voice agents.

## Features

- Full voice agent functionality for Node.js
- Support for telephony integration (Twilio, Vonage)
- WebSocket server for real-time streaming
- CLI voice assistant
- Background voice agent service

## Installation

```bash
npm install @sahayak/voice-agent-node
```

## Quick Start

### CLI Voice Assistant

```typescript
// cli-assistant.ts
import { VoiceAgent } from '@sahayak/voice-agent-node';
import { createInterface } from 'readline';

async function main() {
  const agent = new VoiceAgent({
    stt: {
      provider: 'deepgram',
      apiKey: process.env.DEEPGRAM_API_KEY!
    },
    llm: {
      provider: 'groq',
      apiKey: process.env.GROQ_API_KEY!,
      model: 'llama-3.3-70b-versatile'
    },
    tts: {
      provider: 'edge-tts',
      voice: 'en-US-GuyNeural'
    },
    systemPrompt: 'You are a helpful CLI assistant.'
  });

  await agent.initialize();

  // Text mode
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('Voice Agent CLI ready. Type your message or "voice" to use microphone.\n');

  rl.on('line', async (input) => {
    if (input.toLowerCase() === 'voice') {
      console.log('Listening... (press Ctrl+C to stop)');
      await agent.start();
    } else if (input.toLowerCase() === 'exit') {
      await agent.stop();
      rl.close();
    } else {
      const response = await agent.processText(input);
      console.log(`\nAssistant: ${response.text}\n`);
    }
  });

  agent.on('transcript', (t) => {
    if (t.isFinal) {
      console.log(`You: ${t.text}`);
    }
  });

  agent.on('response', (r) => {
    console.log(`Assistant: ${r.text}\n`);
  });
}

main().catch(console.error);
```

### WebSocket Server

```typescript
// websocket-server.ts
import { WebSocket, WebSocketServer } from 'ws';
import { VoiceAgent } from '@sahayak/voice-agent-node';
import { createServer } from 'http';

const server = createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', async (ws) => {
  console.log('Client connected');
  
  const agent = new VoiceAgent({
    stt: {
      provider: 'deepgram',
      apiKey: process.env.DEEPGRAM_API_KEY!,
      interimResults: true
    },
    llm: {
      provider: 'groq',
      apiKey: process.env.GROQ_API_KEY!
    },
    tts: {
      provider: 'edge-tts'
    }
  });
  
  await agent.initialize();
  
  // Forward agent events to client
  agent.on('transcript', (transcript) => {
    ws.send(JSON.stringify({ type: 'transcript', payload: transcript }));
  });
  
  agent.on('response', (response) => {
    ws.send(JSON.stringify({ type: 'response', payload: response }));
  });
  
  agent.on('audio', (chunk) => {
    ws.send(chunk); // Binary audio data
  });
  
  agent.on('stateChange', ({ current }) => {
    ws.send(JSON.stringify({ type: 'state', payload: { state: current } }));
  });
  
  // Handle client messages
  ws.on('message', async (data, isBinary) => {
    if (isBinary) {
      // Audio data from client
      agent.processAudio(data as Buffer);
    } else {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'start':
          await agent.start();
          break;
        case 'stop':
          await agent.stop();
          break;
        case 'text':
          await agent.processText(message.text);
          break;
        case 'config':
          agent.setContext(message.context);
          break;
      }
    }
  });
  
  ws.on('close', async () => {
    console.log('Client disconnected');
    await agent.stop();
  });
});

server.listen(8080, () => {
  console.log('WebSocket server running on ws://localhost:8080');
});
```

### Express.js Integration

```typescript
// express-integration.ts
import express from 'express';
import expressWs from 'express-ws';
import { VoiceAgent } from '@sahayak/voice-agent-node';

const app = express();
expressWs(app);

app.use(express.json());

// REST endpoint for text-based interaction
app.post('/api/chat', async (req, res) => {
  const { text, sessionId } = req.body;
  
  // Get or create session agent
  const agent = getOrCreateAgent(sessionId);
  
  try {
    const response = await agent.processText(text);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket endpoint for voice interaction
(app as any).ws('/ws/voice', async (ws: any, req: any) => {
  const sessionId = req.query.sessionId;
  const agent = getOrCreateAgent(sessionId);
  
  await agent.initialize();
  
  agent.on('transcript', (t) => {
    ws.send(JSON.stringify({ type: 'transcript', data: t }));
  });
  
  agent.on('response', (r) => {
    ws.send(JSON.stringify({ type: 'response', data: r }));
  });
  
  agent.on('audio', (chunk) => {
    ws.send(chunk);
  });
  
  ws.on('message', (data: Buffer) => {
    if (data[0] === 0x7b) { // JSON message
      const msg = JSON.parse(data.toString());
      if (msg.type === 'start') agent.start();
      if (msg.type === 'stop') agent.stop();
    } else {
      agent.processAudio(data);
    }
  });
  
  ws.on('close', () => agent.stop());
});

// Session management
const sessions = new Map<string, VoiceAgent>();

function getOrCreateAgent(sessionId: string): VoiceAgent {
  if (!sessions.has(sessionId)) {
    const agent = new VoiceAgent({
      stt: { provider: 'deepgram', apiKey: process.env.DEEPGRAM_API_KEY! },
      llm: { provider: 'groq', apiKey: process.env.GROQ_API_KEY! },
      tts: { provider: 'edge-tts' }
    });
    sessions.set(sessionId, agent);
  }
  return sessions.get(sessionId)!;
}

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### Twilio Integration

```typescript
// twilio-integration.ts
import express from 'express';
import { VoiceResponse } from 'twilio/lib/twiml/VoiceResponse';
import { VoiceAgent } from '@sahayak/voice-agent-node';
import WebSocket from 'ws';

const app = express();
app.use(express.urlencoded({ extended: false }));

// Active calls
const calls = new Map<string, VoiceAgent>();

// Incoming call webhook
app.post('/voice/incoming', (req, res) => {
  const response = new VoiceResponse();
  const callSid = req.body.CallSid;
  
  // Create agent for this call
  const agent = new VoiceAgent({
    stt: {
      provider: 'deepgram',
      apiKey: process.env.DEEPGRAM_API_KEY!,
      model: 'nova-2-phonecall'
    },
    llm: {
      provider: 'groq',
      apiKey: process.env.GROQ_API_KEY!
    },
    tts: {
      provider: 'edge-tts',
      voice: 'en-US-AriaNeural'
    },
    systemPrompt: `You are a phone assistant for Acme Corp. 
    Be concise and professional. Answer in 1-2 sentences.`
  });
  
  calls.set(callSid, agent);
  
  // Initial greeting
  response.say('Hello! Thank you for calling. How can I help you today?');
  
  // Connect to WebSocket for bidirectional audio
  response.connect().stream({
    url: `wss://${req.headers.host}/voice/stream/${callSid}`
  });
  
  res.type('text/xml');
  res.send(response.toString());
});

// WebSocket for audio streaming
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', async (ws, req) => {
  const callSid = req.url!.split('/').pop()!;
  const agent = calls.get(callSid);
  
  if (!agent) {
    ws.close();
    return;
  }
  
  await agent.initialize();
  
  // Handle Twilio media messages
  ws.on('message', async (data) => {
    const message = JSON.parse(data.toString());
    
    switch (message.event) {
      case 'connected':
        console.log(`Call ${callSid} connected`);
        break;
        
      case 'start':
        console.log(`Stream started: ${message.streamSid}`);
        break;
        
      case 'media':
        // Decode audio from Twilio (mulaw)
        const audio = Buffer.from(message.media.payload, 'base64');
        agent.processAudio(audio);
        break;
        
      case 'stop':
        console.log('Stream stopped');
        await agent.stop();
        calls.delete(callSid);
        break;
    }
  });
  
  // Send audio back to Twilio
  agent.on('audio', (chunk) => {
    const payload = chunk.toString('base64');
    ws.send(JSON.stringify({
      event: 'media',
      streamSid: message.streamSid,
      media: {
        payload
      }
    }));
  });
});

// Upgrade HTTP to WebSocket
app.server.on('upgrade', (request, socket, head) => {
  if (request.url?.startsWith('/voice/stream/')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

app.listen(3000);
```

## API Reference

### VoiceAgent

```typescript
class VoiceAgent extends EventEmitter {
  constructor(config: VoiceAgentConfig);
  
  // Lifecycle
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  // Processing
  processText(text: string): Promise<Response>;
  processAudio(chunk: Buffer): void;
  speak(text: string): Promise<void>;
  
  // State
  getState(): VoiceAgentState;
  setContext(context: Record<string, any>): void;
  clearHistory(): void;
  
  // Actions
  registerAction(handler: ActionHandler): void;
  
  // Events
  on(event: 'transcript', listener: (transcript: Transcript) => void): this;
  on(event: 'response', listener: (response: Response) => void): this;
  on(event: 'audio', listener: (chunk: Buffer) => void): this;
  on(event: 'stateChange', listener: (change: StateChange) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
}
```

### Configuration

```typescript
interface VoiceAgentConfig {
  stt: {
    provider: 'deepgram' | 'whisper' | 'google' | 'azure';
    apiKey?: string;
    endpoint?: string;
    model?: string;
    language?: string;
    interimResults?: boolean;
  };
  
  llm: {
    provider: 'groq' | 'openai' | 'anthropic' | 'ollama';
    apiKey?: string;
    endpoint?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
  
  tts: {
    provider: 'edge-tts' | 'elevenlabs' | 'google' | 'azure';
    apiKey?: string;
    voice?: string;
    rate?: number;
    pitch?: number;
  };
  
  systemPrompt?: string;
  language?: string;
  actions?: ActionHandler[];
}
```

### Audio Processing

```typescript
import { AudioProcessor } from '@sahayak/voice-agent-node';

// Convert between formats
const processor = new AudioProcessor();

// From microphone (PCM) to Deepgram format
const deepgramAudio = processor.convertToDeepgram(microphoneBuffer);

// From Twilio (mulaw) to PCM
const pcmAudio = processor.mulawToPcm(twilioBuffer);

// PCM to MP3 for storage
const mp3Audio = await processor.pcmToMp3(pcmBuffer);

// Resample audio
const resampled = processor.resample(buffer, 44100, 16000);
```

### Microphone Input (Node.js)

```typescript
import { Microphone } from '@sahayak/voice-agent-node';

const mic = new Microphone({
  sampleRate: 16000,
  channels: 1,
  device: 'default' // or specific device ID
});

mic.on('data', (chunk) => {
  agent.processAudio(chunk);
});

mic.on('error', (error) => {
  console.error('Microphone error:', error);
});

await mic.start();

// Later
await mic.stop();
```

### Speaker Output (Node.js)

```typescript
import { Speaker } from '@sahayak/voice-agent-node';

const speaker = new Speaker({
  sampleRate: 24000,
  channels: 1,
  device: 'default'
});

agent.on('audio', (chunk) => {
  speaker.play(chunk);
});

// Or play a file
await speaker.playFile('./response.mp3');
```

## Examples

### Banking Voice Agent

```typescript
import { VoiceAgent } from '@sahayak/voice-agent-node';

const bankingAgent = new VoiceAgent({
  stt: { provider: 'deepgram', apiKey: process.env.DEEPGRAM_API_KEY! },
  llm: { provider: 'groq', apiKey: process.env.GROQ_API_KEY! },
  tts: { provider: 'edge-tts', voice: 'en-US-JennyNeural' },
  systemPrompt: `You are a banking assistant for ABC Bank.
You can help with:
- Checking account balances
- Recent transactions
- Transferring money
- Bill payments

Always verify identity before sensitive operations.
Respond in a friendly but professional manner.`,
  actions: [
    {
      type: 'check_balance',
      handle: async (action) => {
        const balance = await bankingApi.getBalance(action.params.accountType);
        return { success: true, data: { balance } };
      }
    },
    {
      type: 'transfer',
      handle: async (action) => {
        const result = await bankingApi.transfer(
          action.params.fromAccount,
          action.params.toAccount,
          action.params.amount
        );
        return { success: result.success, data: result };
      }
    }
  ]
});
```

### Home Automation Agent

```typescript
import { VoiceAgent } from '@sahayak/voice-agent-node';
import { HomeAssistant } from 'home-assistant-js-websocket';

const ha = await HomeAssistant.connect(process.env.HA_URL, process.env.HA_TOKEN);

const homeAgent = new VoiceAgent({
  stt: { provider: 'whisper', endpoint: 'http://localhost:8000' },
  llm: { provider: 'ollama', endpoint: 'http://localhost:11434', model: 'llama3' },
  tts: { provider: 'edge-tts' },
  systemPrompt: `You are a home automation assistant.
Available devices: lights, thermostat, TV, speakers, blinds.
Current state will be provided with context.`,
  actions: [
    {
      type: 'turn_on',
      handle: async (action) => {
        await ha.callService('homeassistant', 'turn_on', {
          entity_id: action.params.entity
        });
        return { success: true };
      }
    },
    {
      type: 'turn_off',
      handle: async (action) => {
        await ha.callService('homeassistant', 'turn_off', {
          entity_id: action.params.entity
        });
        return { success: true };
      }
    },
    {
      type: 'set_temperature',
      handle: async (action) => {
        await ha.callService('climate', 'set_temperature', {
          entity_id: 'climate.thermostat',
          temperature: action.params.temperature
        });
        return { success: true };
      }
    }
  ]
});

// Update context with current state
setInterval(async () => {
  const states = await ha.getStates();
  homeAgent.setContext({
    devices: states.map(s => ({
      id: s.entity_id,
      state: s.state,
      attributes: s.attributes
    }))
  });
}, 5000);
```

## Package Structure

```
@sahayak/voice-agent-node/
├── src/
│   ├── index.ts
│   ├── VoiceAgent.ts
│   ├── providers/
│   │   ├── stt/
│   │   │   ├── DeepgramSTTProvider.ts
│   │   │   ├── WhisperSTTProvider.ts
│   │   │   └── ...
│   │   ├── llm/
│   │   │   ├── GroqLLMProvider.ts
│   │   │   ├── OllamaLLMProvider.ts
│   │   │   └── ...
│   │   └── tts/
│   │       ├── EdgeTTSProvider.ts
│   │       └── ...
│   ├── audio/
│   │   ├── AudioProcessor.ts
│   │   ├── Microphone.ts
│   │   └── Speaker.ts
│   └── integrations/
│       ├── twilio/
│       ├── vonage/
│       └── websocket/
├── dist/
├── package.json
└── README.md
```

## Requirements

- Node.js 18+
- For microphone: platform-specific audio library (portaudio, ALSA, CoreAudio)
- For speaker: platform-specific audio library

## License

MIT
