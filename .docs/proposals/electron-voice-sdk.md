# Electron Voice SDK Proposal

## Feature: Official Voice Agent SDK for Electron Applications

**Status**: Draft  
**Author**: Sahayak Team  
**Repository**: https://github.com/electron/electron  
**Target**: Electron v30+

---

## Summary

Provide a first-class voice agent SDK for Electron applications, enabling desktop app developers to easily add conversational AI capabilities with proper system integration, native audio handling, and cross-platform support.

---

## Motivation

### Current Challenges

1. **No Native Voice Support**: Electron apps must use Web Speech API (limited) or third-party packages
2. **Audio Complexity**: Handling microphone access, audio routing, and system integration is complex
3. **No Desktop Integration**: No system-level voice assistant features (global hotkeys, system tray, etc.)
4. **Security Concerns**: Running voice AI requires careful sandboxing

### Target Applications

- **VS Code**: Voice coding features
- **Slack/Discord Desktop**: Voice commands
- **Notion/Obsidian**: Voice note-taking
- **Custom Enterprise Apps**: Voice-controlled workflows

---

## Proposed API

### 1. Main Process API

```typescript
// electron/voice-agent.ts

import { BrowserWindow, app, globalShortcut } from 'electron';

export interface VoiceAgentConfig {
  // STT Configuration
  stt: {
    provider: 'whisper-local' | 'deepgram' | 'google' | 'custom';
    language?: string;
    model?: string;
    customEndpoint?: string;
  };
  
  // LLM Configuration
  llm: {
    provider: 'ollama' | 'groq' | 'openai' | 'anthropic' | 'custom';
    model?: string;
    endpoint?: string;
    systemPrompt?: string;
  };
  
  // TTS Configuration
  tts: {
    provider: 'piper-local' | 'edge-tts' | 'elevenlabs' | 'system' | 'custom';
    voice?: string;
    rate?: number;
    pitch?: number;
  };
  
  // System Integration
  system: {
    globalHotkey?: string;  // e.g., 'CommandOrControl+Shift+V'
    showInTray?: boolean;
    startMinimized?: boolean;
    runAtStartup?: boolean;
  };
  
  // Privacy
  privacy: {
    localOnly?: boolean;
    saveHistory?: boolean;
    telemetry?: boolean;
  };
}

export class VoiceAgent extends EventEmitter {
  constructor(config: VoiceAgentConfig);
  
  // Lifecycle
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  
  // Voice Control
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  isListening(): boolean;
  
  // TTS
  speak(text: string, options?: SpeakOptions): Promise<void>;
  stopSpeaking(): void;
  isSpeaking(): boolean;
  
  // Context Management
  setContext(context: Record<string, any>): void;
  addMessage(message: { role: string; content: string }): void;
  clearContext(): void;
  
  // Window Management
  attachToWindow(window: BrowserWindow): void;
  detachFromWindow(): void;
  
  // Events
  on(event: 'listening-start', listener: () => void): this;
  on(event: 'listening-stop', listener: () => void): this;
  on(event: 'transcript', listener: (transcript: Transcript) => void): this;
  on(event: 'response', listener: (response: Response) => void): this;
  on(event: 'action', listener: (action: Action) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'state-change', listener: (state: VoiceAgentState) => void): this;
}
```

### 2. Renderer Process API (Preload)

```typescript
// preload/voice-agent.ts

export interface VoiceAgentAPI {
  // Control
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  speak(text: string): Promise<void>;
  
  // State
  getState(): Promise<VoiceAgentState>;
  isListening(): Promise<boolean>;
  isSpeaking(): Promise<boolean>;
  
  // Events (via IPC)
  onTranscript(callback: (transcript: Transcript) => void): () => void;
  onResponse(callback: (response: Response) => void): () => void;
  onAction(callback: (action: Action) => void): () => void;
  onStateChange(callback: (state: VoiceAgentState) => void): () => void;
  
  // Configuration
  setContext(context: Record<string, any>): Promise<void>;
}

// Exposed via contextBridge
declare global {
  interface Window {
    voiceAgent: VoiceAgentAPI;
  }
}
```

### 3. Local Processing Module

```typescript
// electron/voice-agent/local-processing.ts

import { spawn } from 'child_process';
import path from 'path';

export class LocalWhisperSTT {
  private process: ChildProcess | null = null;
  private modelPath: string;
  
  constructor(modelName: string = 'base.en') {
    // Models bundled with app or downloaded on first use
    this.modelPath = path.join(app.getPath('userData'), 'models', 'whisper', modelName);
  }
  
  async initialize(): Promise<void> {
    // Check if model exists, download if not
    if (!await this.modelExists()) {
      await this.downloadModel();
    }
    
    // Start whisper process
    this.process = spawn(this.getWhisperBinary(), [
      '--model', this.modelPath,
      '--stream',
      '--output-format', 'json'
    ]);
  }
  
  async *transcribe(audioStream: AsyncIterable<Buffer>): AsyncGenerator<Transcript> {
    for await (const chunk of audioStream) {
      this.process.stdin.write(chunk);
      
      // Read from stdout
      const result = await this.readOutput();
      if (result) {
        yield {
          text: result.text,
          confidence: result.confidence,
          isFinal: result.is_final
        };
      }
    }
  }
  
  private getWhisperBinary(): string {
    const platform = process.platform;
    const binaries = {
      darwin: 'whisper-darwin',
      win32: 'whisper-win.exe',
      linux: 'whisper-linux'
    };
    return path.join(app.getAppPath(), 'bin', binaries[platform]);
  }
}

export class LocalOllamaLLM {
  private endpoint: string;
  
  constructor(model: string = 'llama3.2:3b') {
    this.model = model;
    this.endpoint = 'http://localhost:11434/api/generate';
  }
  
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: this.buildPrompt(request),
        stream: false
      })
    });
    
    const data = await response.json();
    return this.parseResponse(data.response);
  }
  
  async *generateStream(request: LLMRequest): AsyncGenerator<string> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: this.buildPrompt(request),
        stream: true
      })
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const text = decoder.decode(value);
      const json = JSON.parse(text);
      yield json.response;
    }
  }
}

export class LocalPiperTTS {
  private process: ChildProcess | null = null;
  private voicePath: string;
  
  constructor(voice: string = 'en_US-lessac-medium') {
    this.voicePath = path.join(app.getPath('userData'), 'models', 'piper', voice);
  }
  
  async synthesize(text: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      
      const process = spawn(this.getPiperBinary(), [
        '--model', this.voicePath,
        '--output-raw'
      ]);
      
      process.stdin.write(text);
      process.stdin.end();
      
      process.stdout.on('data', (chunk) => chunks.push(chunk));
      process.on('close', () => resolve(Buffer.concat(chunks)));
      process.on('error', reject);
    });
  }
  
  async *synthesizeStream(text: string): AsyncGenerator<Buffer> {
    const process = spawn(this.getPiperBinary(), [
      '--model', this.voicePath,
      '--output-raw'
    ]);
    
    process.stdin.write(text);
    process.stdin.end();
    
    for await (const chunk of process.stdout) {
      yield chunk;
    }
  }
}
```

---

## Usage Examples

### Basic Voice Assistant

```typescript
// main.ts
import { app, BrowserWindow, globalShortcut } from 'electron';
import { VoiceAgent } from '@electron/voice-agent';

let mainWindow: BrowserWindow;
let voiceAgent: VoiceAgent;

app.whenReady().then(async () => {
  // Create window
  mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  // Initialize voice agent
  voiceAgent = new VoiceAgent({
    stt: { provider: 'whisper-local', model: 'base.en' },
    llm: { provider: 'ollama', model: 'llama3.2:3b' },
    tts: { provider: 'piper-local', voice: 'en_US-lessac-medium' },
    system: {
      globalHotkey: 'CommandOrControl+Shift+V',
      showInTray: true
    },
    privacy: { localOnly: true }
  });
  
  await voiceAgent.initialize();
  voiceAgent.attachToWindow(mainWindow);
  
  // Handle events
  voiceAgent.on('transcript', (t) => {
    mainWindow.webContents.send('voice:transcript', t);
  });
  
  voiceAgent.on('response', (r) => {
    mainWindow.webContents.send('voice:response', r);
  });
  
  voiceAgent.on('action', async (action) => {
    await handleAction(action);
  });
});

async function handleAction(action: Action) {
  switch (action.type) {
    case 'open-file':
      shell.openPath(action.params.path);
      break;
    case 'run-command':
      exec(action.params.command);
      break;
    case 'navigate':
      mainWindow.loadURL(action.params.url);
      break;
  }
}
```

### Renderer Usage

```typescript
// renderer.ts

// Listen for voice events
window.voiceAgent.onTranscript((transcript) => {
  document.getElementById('transcript').textContent = transcript.text;
});

window.voiceAgent.onResponse((response) => {
  document.getElementById('response').textContent = response.text;
});

// Control voice agent
document.getElementById('mic-btn').addEventListener('click', async () => {
  const isListening = await window.voiceAgent.isListening();
  if (isListening) {
    await window.voiceAgent.stopListening();
  } else {
    await window.voiceAgent.startListening();
  }
});

// Update context based on app state
async function updateVoiceContext() {
  await window.voiceAgent.setContext({
    currentFile: getCurrentFile(),
    selectedText: getSelectedText(),
    recentActions: getRecentActions()
  });
}
```

### VS Code Integration Example

```typescript
// VS Code extension using Electron voice SDK

import * as vscode from 'vscode';
import { VoiceAgent } from '@electron/voice-agent';

export function activate(context: vscode.ExtensionContext) {
  const voiceAgent = new VoiceAgent({
    stt: { provider: 'deepgram' },
    llm: {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      systemPrompt: `You are a VS Code coding assistant. Help users with:
        - Code navigation (go to file, go to line, go to symbol)
        - Code editing (insert, replace, delete)
        - Running commands (build, test, debug)
        - File operations (create, rename, delete)
        
        Respond with clear actions and explanations.`
    },
    tts: { provider: 'edge-tts' }
  });
  
  // Register voice commands
  voiceAgent.on('action', async (action) => {
    switch (action.type) {
      case 'go-to-file':
        await vscode.commands.executeCommand('workbench.action.quickOpen', action.params.query);
        break;
        
      case 'go-to-line':
        await vscode.commands.executeCommand('workbench.action.gotoLine');
        vscode.window.activeTextEditor?.revealRange(
          new vscode.Range(action.params.line, 0, action.params.line, 0)
        );
        break;
        
      case 'insert-code':
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          await editor.edit(builder => {
            builder.insert(editor.selection.active, action.params.code);
          });
        }
        break;
        
      case 'run-command':
        await vscode.commands.executeCommand(action.params.command);
        break;
    }
  });
  
  // Register activation command
  const startListening = vscode.commands.registerCommand(
    'voice-assistant.startListening',
    () => voiceAgent.startListening()
  );
  
  const stopListening = vscode.commands.registerCommand(
    'voice-assistant.stopListening',
    () => voiceAgent.stopListening()
  );
  
  context.subscriptions.push(startListening, stopListening);
}
```

---

## System Integration

### Global Hotkey Registration

```typescript
// Global hotkey for voice activation
app.whenReady().then(() => {
  globalShortcut.register('CommandOrControl+Shift+V', () => {
    if (voiceAgent.isListening()) {
      voiceAgent.stopListening();
    } else {
      voiceAgent.startListening();
    }
  });
});
```

### System Tray Integration

```typescript
// System tray for voice assistant
const tray = new Tray(path.join(__dirname, 'assets/tray-icon.png'));

const contextMenu = Menu.buildFromTemplate([
  {
    label: 'Start Listening',
    click: () => voiceAgent.startListening()
  },
  {
    label: 'Settings',
    click: () => openSettings()
  },
  { type: 'separator' },
  {
    label: 'Quit',
    click: () => app.quit()
  }
]);

tray.setContextMenu(contextMenu);

// Update tray icon based on state
voiceAgent.on('state-change', (state) => {
  const icons = {
    idle: 'tray-icon.png',
    listening: 'tray-icon-listening.png',
    processing: 'tray-icon-processing.png',
    speaking: 'tray-icon-speaking.png'
  };
  tray.setImage(path.join(__dirname, 'assets', icons[state]));
});
```

### Native Audio Integration

```typescript
// Native audio capture using Electron's media APIs
class NativeAudioCapture {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  
  async start(): Promise<AsyncGenerator<Buffer>> {
    // Request microphone access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    
    // Create processor for raw audio access
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    return this.createAudioGenerator();
  }
  
  private async *createAudioGenerator(): AsyncGenerator<Buffer> {
    const queue: Buffer[] = [];
    let resolve: (() => void) | null = null;
    
    this.processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const int16Data = this.float32ToInt16(inputData);
      queue.push(Buffer.from(int16Data.buffer));
      
      if (resolve) {
        resolve();
        resolve = null;
      }
    };
    
    while (true) {
      if (queue.length > 0) {
        yield queue.shift()!;
      } else {
        await new Promise<void>(r => resolve = r);
      }
    }
  }
  
  private float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
  }
  
  stop() {
    this.processor?.disconnect();
    this.audioContext?.close();
    this.mediaStream?.getTracks().forEach(track => track.stop());
  }
}
```

---

## Security Considerations

### Sandboxing

```typescript
// Voice agent runs in isolated process
const voiceAgentProcess = utilityProcess.fork(
  path.join(__dirname, 'voice-agent-process.js'),
  {
    serviceName: 'voice-agent',
    stdio: 'pipe'
  }
);

// Communication via IPC only
voiceAgentProcess.on('message', (message) => {
  handleVoiceAgentMessage(message);
});
```

### Permission Model

```typescript
// Permissions required for voice agent
const REQUIRED_PERMISSIONS = {
  microphone: 'required',
  systemAudio: 'optional',
  globalShortcuts: 'optional',
  autoStart: 'optional'
};

// Permission check before initialization
async function checkPermissions(): Promise<PermissionStatus[]> {
  const statuses = await Promise.all([
    systemPreferences.getMediaAccessStatus('microphone'),
    // Additional permission checks
  ]);
  
  return statuses;
}
```

### Data Protection

```typescript
// Local-only mode ensures no data leaves device
if (config.privacy.localOnly) {
  // Use only local providers
  assert(config.stt.provider.endsWith('-local'));
  assert(config.llm.provider === 'ollama');
  assert(config.tts.provider.endsWith('-local'));
  
  // Disable any network calls
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['*://*/*'] },
    (details, callback) => {
      if (isVoiceAgentRequest(details)) {
        callback({ cancel: true });
      } else {
        callback({});
      }
    }
  );
}
```

---

## Package Structure

```
@electron/voice-agent/
├── src/
│   ├── main/
│   │   ├── VoiceAgent.ts
│   │   ├── providers/
│   │   │   ├── STTProvider.ts
│   │   │   ├── LLMProvider.ts
│   │   │   ├── TTSProvider.ts
│   │   │   ├── whisper/
│   │   │   ├── ollama/
│   │   │   └── piper/
│   │   ├── audio/
│   │   │   ├── AudioCapture.ts
│   │   │   └── AudioPlayback.ts
│   │   └── system/
│   │       ├── GlobalHotkey.ts
│   │       ├── SystemTray.ts
│   │       └── Notifications.ts
│   │
│   ├── preload/
│   │   └── voiceAgentPreload.ts
│   │
│   └── renderer/
│       └── VoiceAgentUI.ts
│
├── bin/
│   ├── whisper-darwin
│   ├── whisper-win.exe
│   ├── whisper-linux
│   ├── piper-darwin
│   ├── piper-win.exe
│   └── piper-linux
│
├── models/
│   └── .gitkeep  # Models downloaded on first use
│
└── package.json
```

---

## Implementation Timeline

### Phase 1: Core SDK (Months 1-2)
- [ ] Main process VoiceAgent class
- [ ] Basic STT integration (Whisper)
- [ ] Basic TTS integration (Piper)
- [ ] Audio capture module

### Phase 2: AI Integration (Months 3-4)
- [ ] LLM provider abstraction
- [ ] Ollama integration
- [ ] Cloud provider support
- [ ] Action plan parsing

### Phase 3: System Integration (Months 5-6)
- [ ] Global hotkey support
- [ ] System tray integration
- [ ] Native notifications
- [ ] Cross-platform testing

### Phase 4: Polish (Months 7-8)
- [ ] Documentation
- [ ] Example applications
- [ ] Performance optimization
- [ ] Security audit

---

## References

1. [Electron Documentation](https://www.electronjs.org/docs)
2. [Whisper.cpp](https://github.com/ggerganov/whisper.cpp)
3. [Piper TTS](https://github.com/rhasspy/piper)
4. [Ollama](https://ollama.ai/)
