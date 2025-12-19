# Browser Extension Example

This directory contains a complete browser extension example demonstrating how to integrate the Sahayak Voice Agent into a Chrome/Firefox extension.

## Features

- Voice activation via keyboard shortcut or toolbar button
- Continuous listening with wake word detection
- Action execution on current page
- Support for Chrome and Firefox

## Project Structure

```
browser-extension/
├── manifest.json           # Extension manifest (MV3)
├── manifest.firefox.json   # Firefox-specific manifest
├── src/
│   ├── background.ts       # Service worker
│   ├── content.ts          # Content script
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.ts
│   │   └── popup.css
│   ├── options/
│   │   ├── options.html
│   │   ├── options.ts
│   │   └── options.css
│   └── lib/
│       ├── voice-agent.ts
│       ├── stt-client.ts
│       └── action-executor.ts
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── package.json
```

## manifest.json (Chrome MV3)

```json
{
  "manifest_version": 3,
  "name": "Voice Agent",
  "version": "1.0.0",
  "description": "Voice-controlled browser assistant powered by Sahayak",
  
  "permissions": [
    "activeTab",
    "storage",
    "scripting"
  ],
  
  "optional_permissions": [
    "tabs",
    "history",
    "bookmarks"
  ],
  
  "host_permissions": [
    "<all_urls>"
  ],
  
  "background": {
    "service_worker": "dist/background.js",
    "type": "module"
  },
  
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["dist/content.js"],
      "css": ["dist/content.css"]
    }
  ],
  
  "action": {
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    },
    "default_popup": "popup/popup.html",
    "default_title": "Voice Agent"
  },
  
  "options_page": "options/options.html",
  
  "commands": {
    "toggle-voice": {
      "suggested_key": {
        "default": "Ctrl+Shift+V",
        "mac": "Command+Shift+V"
      },
      "description": "Toggle voice assistant"
    }
  },
  
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

## Background Service Worker

```typescript
// src/background.ts

import { VoiceAgent } from '@sahayak/voice-agent-core';

let agent: VoiceAgent | null = null;
let isListening = false;

// Initialize agent
async function initializeAgent() {
  const config = await chrome.storage.sync.get(['sttApiKey', 'llmApiKey', 'voice']);
  
  agent = new VoiceAgent({
    stt: {
      provider: 'deepgram',
      apiKey: config.sttApiKey
    },
    llm: {
      provider: 'groq',
      apiKey: config.llmApiKey,
      model: 'llama-3.3-70b-versatile'
    },
    tts: {
      provider: 'edge-tts',
      voice: config.voice || 'en-US-AriaNeural'
    },
    systemPrompt: `You are a helpful browser assistant. You can help users navigate websites, 
fill forms, search content, and perform actions on web pages.

Available actions:
- navigate: Go to a URL. Params: url
- click: Click an element. Params: selector, text
- type: Type text into an input. Params: selector, text
- scroll: Scroll the page. Params: direction (up/down), amount
- search: Search the page. Params: query
- read: Read content aloud. Params: selector
- goBack: Go back in history
- goForward: Go forward in history
- refresh: Refresh the page
- newTab: Open new tab. Params: url
- closeTab: Close current tab

Always respond with structured JSON including:
- response: Text to speak to the user
- actions: Array of actions to execute

Current page context will be provided with each request.`
  });
  
  await agent.initialize();
  
  agent.on('response', async (response) => {
    // Send response to content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'VOICE_RESPONSE',
        payload: response
      });
    }
  });
  
  agent.on('audio', async (chunk) => {
    // Send audio to content script for playback
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'VOICE_AUDIO',
        payload: Array.from(new Uint8Array(chunk))
      });
    }
  });
}

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-voice') {
    await toggleVoice();
  }
});

// Handle messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'TOGGLE_VOICE':
      toggleVoice().then(() => sendResponse({ success: true }));
      return true;
      
    case 'GET_STATUS':
      sendResponse({ isListening, isInitialized: agent !== null });
      return true;
      
    case 'PROCESS_TEXT':
      if (agent) {
        agent.processText(message.text).then((response) => {
          sendResponse({ success: true, response });
        });
      }
      return true;
      
    case 'PAGE_CONTEXT':
      // Store page context for LLM
      if (agent) {
        agent.setContext({
          url: message.url,
          title: message.title,
          content: message.content
        });
      }
      return true;
  }
});

async function toggleVoice() {
  if (!agent) {
    await initializeAgent();
  }
  
  if (isListening) {
    await agent.stop();
    isListening = false;
    updateIcon(false);
  } else {
    await agent.start();
    isListening = true;
    updateIcon(true);
  }
  
  // Notify content script
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'VOICE_STATUS',
      payload: { isListening }
    });
  }
}

function updateIcon(active: boolean) {
  const path = active ? 'icons/icon-active' : 'icons/icon';
  chrome.action.setIcon({
    path: {
      '16': `${path}-16.png`,
      '48': `${path}-48.png`,
      '128': `${path}-128.png`
    }
  });
}

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Voice Agent extension installed');
});
```

## Content Script

```typescript
// src/content.ts

import { ActionExecutor } from './lib/action-executor';

const executor = new ActionExecutor();
let audioPlayer: AudioPlayer | null = null;

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'VOICE_STATUS':
      updateUI(message.payload.isListening);
      break;
      
    case 'VOICE_RESPONSE':
      handleResponse(message.payload);
      break;
      
    case 'VOICE_AUDIO':
      playAudio(message.payload);
      break;
      
    case 'EXECUTE_ACTION':
      executor.execute(message.payload)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
  }
});

// Send page context to background
function sendPageContext() {
  chrome.runtime.sendMessage({
    type: 'PAGE_CONTEXT',
    url: window.location.href,
    title: document.title,
    content: getPageContent()
  });
}

function getPageContent(): string {
  // Extract relevant page content
  const main = document.querySelector('main, article, [role="main"]');
  const content = main || document.body;
  
  // Get text content, limiting length
  return content.textContent?.slice(0, 5000) || '';
}

// Handle voice response
async function handleResponse(response: any) {
  // Show visual feedback
  showTranscript(response.text);
  
  // Execute actions
  if (response.actions) {
    for (const action of response.actions) {
      await executor.execute(action);
    }
  }
}

// Audio playback
class AudioPlayer {
  private context: AudioContext;
  private queue: ArrayBuffer[] = [];
  private isPlaying = false;
  
  constructor() {
    this.context = new AudioContext();
  }
  
  async play(data: number[]) {
    const buffer = new Uint8Array(data).buffer;
    this.queue.push(buffer);
    
    if (!this.isPlaying) {
      this.isPlaying = true;
      await this.processQueue();
    }
  }
  
  private async processQueue() {
    while (this.queue.length > 0) {
      const buffer = this.queue.shift()!;
      const audioBuffer = await this.context.decodeAudioData(buffer.slice(0));
      
      await new Promise<void>((resolve) => {
        const source = this.context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.context.destination);
        source.onended = () => resolve();
        source.start();
      });
    }
    this.isPlaying = false;
  }
}

function playAudio(data: number[]) {
  if (!audioPlayer) {
    audioPlayer = new AudioPlayer();
  }
  audioPlayer.play(data);
}

// UI Components
function updateUI(isListening: boolean) {
  let indicator = document.getElementById('voice-agent-indicator');
  
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'voice-agent-indicator';
    indicator.innerHTML = `
      <div class="voice-agent-pill">
        <div class="voice-agent-icon"></div>
        <span class="voice-agent-text">Listening...</span>
      </div>
    `;
    document.body.appendChild(indicator);
  }
  
  indicator.classList.toggle('active', isListening);
}

function showTranscript(text: string) {
  let toast = document.getElementById('voice-agent-toast');
  
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'voice-agent-toast';
    document.body.appendChild(toast);
  }
  
  toast.textContent = text;
  toast.classList.add('visible');
  
  setTimeout(() => {
    toast.classList.remove('visible');
  }, 5000);
}

// Initialize
sendPageContext();

// Update context on navigation
const observer = new MutationObserver(() => {
  sendPageContext();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
```

## Action Executor

```typescript
// src/lib/action-executor.ts

export class ActionExecutor {
  async execute(action: any): Promise<{ success: boolean; data?: any }> {
    switch (action.type) {
      case 'navigate':
        return this.navigate(action.params);
      case 'click':
        return this.click(action.params);
      case 'type':
        return this.type(action.params);
      case 'scroll':
        return this.scroll(action.params);
      case 'search':
        return this.search(action.params);
      case 'read':
        return this.read(action.params);
      case 'goBack':
        window.history.back();
        return { success: true };
      case 'goForward':
        window.history.forward();
        return { success: true };
      case 'refresh':
        window.location.reload();
        return { success: true };
      default:
        return { success: false };
    }
  }
  
  private navigate(params: { url: string }) {
    window.location.href = params.url;
    return { success: true };
  }
  
  private click(params: { selector?: string; text?: string }) {
    let element: Element | null = null;
    
    if (params.selector) {
      element = document.querySelector(params.selector);
    } else if (params.text) {
      // Find by text content
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT,
        null
      );
      
      while (walker.nextNode()) {
        const node = walker.currentNode as Element;
        if (node.textContent?.toLowerCase().includes(params.text.toLowerCase())) {
          if (node.tagName === 'A' || node.tagName === 'BUTTON' || 
              node.getAttribute('role') === 'button') {
            element = node;
            break;
          }
        }
      }
    }
    
    if (element) {
      (element as HTMLElement).click();
      return { success: true };
    }
    
    return { success: false };
  }
  
  private type(params: { selector: string; text: string }) {
    const element = document.querySelector(params.selector) as HTMLInputElement;
    
    if (element) {
      element.focus();
      element.value = params.text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      return { success: true };
    }
    
    return { success: false };
  }
  
  private scroll(params: { direction: 'up' | 'down'; amount?: number }) {
    const amount = params.amount || 300;
    const delta = params.direction === 'up' ? -amount : amount;
    window.scrollBy({ top: delta, behavior: 'smooth' });
    return { success: true };
  }
  
  private search(params: { query: string }) {
    // Use browser's find API
    window.find(params.query);
    return { success: true };
  }
  
  private read(params: { selector?: string }) {
    const element = params.selector 
      ? document.querySelector(params.selector)
      : document.body;
    
    if (element) {
      const text = element.textContent?.slice(0, 1000);
      return { success: true, data: { text } };
    }
    
    return { success: false };
  }
}
```

## Popup

```html
<!-- src/popup/popup.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voice Agent</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <header>
      <img src="../icons/icon-48.png" alt="Voice Agent" class="logo">
      <h1>Voice Agent</h1>
    </header>
    
    <main>
      <button id="toggle-btn" class="toggle-btn">
        <span class="mic-icon"></span>
        <span class="btn-text">Start Listening</span>
      </button>
      
      <div id="status" class="status">
        Press Ctrl+Shift+V to toggle voice
      </div>
      
      <div id="transcript" class="transcript"></div>
    </main>
    
    <footer>
      <a href="options.html" target="_blank">Settings</a>
      <a href="https://github.com/sahayak/voice-agent" target="_blank">Help</a>
    </footer>
  </div>
  
  <script src="popup.js" type="module"></script>
</body>
</html>
```

```typescript
// src/popup/popup.ts

const toggleBtn = document.getElementById('toggle-btn')!;
const statusDiv = document.getElementById('status')!;
const transcriptDiv = document.getElementById('transcript')!;

let isListening = false;

// Get initial status
chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
  isListening = response.isListening;
  updateUI();
});

// Toggle button click
toggleBtn.addEventListener('click', async () => {
  chrome.runtime.sendMessage({ type: 'TOGGLE_VOICE' }, () => {
    isListening = !isListening;
    updateUI();
  });
});

function updateUI() {
  toggleBtn.classList.toggle('active', isListening);
  toggleBtn.querySelector('.btn-text')!.textContent = 
    isListening ? 'Stop Listening' : 'Start Listening';
  statusDiv.textContent = isListening ? 'Listening...' : 'Press Ctrl+Shift+V to toggle voice';
}
```

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Load unpacked extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

## Configuration

1. Click the extension icon
2. Go to Settings
3. Enter your API keys:
   - Deepgram API Key (for STT)
   - Groq API Key (for LLM)
4. Select preferred voice

## Usage

- Press `Ctrl+Shift+V` (or `Cmd+Shift+V` on Mac) to toggle voice
- Click the extension icon to open the popup
- Speak commands like:
  - "Go to Google"
  - "Search for voice assistants"
  - "Click the first link"
  - "Scroll down"
  - "Read this page"
