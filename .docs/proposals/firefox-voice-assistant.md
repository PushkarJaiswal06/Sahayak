# Mozilla Firefox Voice Assistant Proposal

## Feature: Reviving Firefox Voice with Modern AI Capabilities

**Status**: Draft  
**Author**: Sahayak Team  
**Component**: Firefox > Voice  
**Bugzilla**: https://bugzilla.mozilla.org  

---

## Executive Summary

This proposal outlines a plan to revive and modernize Mozilla's discontinued Firefox Voice project by integrating modern AI capabilities, supporting custom speech providers, and creating an open voice assistant framework that respects user privacy.

---

## Background

### Firefox Voice History

Firefox Voice was an experimental browser extension that allowed users to control Firefox using voice commands. It was discontinued in 2021 due to:

1. Dependency on Google Cloud Speech API
2. Limited functionality (browser control only)
3. Maintenance burden
4. Privacy concerns with cloud-based speech recognition

### Why Revive It Now?

1. **Open-source LLMs**: Models like Llama can run locally
2. **Local STT**: Whisper provides high-quality local speech recognition
3. **Privacy-first AI**: Growing demand for privacy-respecting AI assistants
4. **Accessibility**: Voice control is essential for accessibility
5. **Competition**: Chrome and Edge have voice features; Firefox should too

---

## Proposal Overview

### Core Features

1. **Privacy-First Design**: Local processing by default
2. **Modular Architecture**: Pluggable STT, LLM, and TTS providers
3. **Open Voice Commands**: Extensible command framework
4. **Web Integration**: APIs for websites to provide voice capabilities
5. **Accessibility Focus**: WCAG compliance and screen reader integration

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    FIREFOX BROWSER                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 Voice Assistant Core                     │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │    │
│  │  │   STT   │  │   NLU   │  │   LLM   │  │   TTS   │    │    │
│  │  │ Module  │  │ Module  │  │ Module  │  │ Module  │    │    │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘    │    │
│  │       │            │            │            │          │    │
│  │  ┌────▼────────────▼────────────▼────────────▼────┐    │    │
│  │  │              Provider Manager                   │    │    │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐          │    │    │
│  │  │  │ Whisper │ │  Groq   │ │Piper TTS│  ...     │    │    │
│  │  │  │ (local) │ │ (cloud) │ │ (local) │          │    │    │
│  │  │  └─────────┘ └─────────┘ └─────────┘          │    │    │
│  │  └────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                    Command Executor                        │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐            │  │
│  │  │  Browser   │ │    Web     │ │  Custom    │            │  │
│  │  │  Commands  │ │  Commands  │ │  Commands  │            │  │
│  │  └────────────┘ └────────────┘ └────────────┘            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. Voice Assistant Core

```javascript
// browser/components/voiceassistant/VoiceAssistant.sys.mjs

export class VoiceAssistant {
  #state = "idle";
  #sttProvider = null;
  #llmProvider = null;
  #ttsProvider = null;
  #commandExecutor = null;
  
  async initialize(config) {
    // Load providers based on user preferences
    this.#sttProvider = await ProviderManager.getSTTProvider(
      Services.prefs.getStringPref("voice.stt.provider", "whisper-local")
    );
    
    this.#llmProvider = await ProviderManager.getLLMProvider(
      Services.prefs.getStringPref("voice.llm.provider", "local-llama")
    );
    
    this.#ttsProvider = await ProviderManager.getTTSProvider(
      Services.prefs.getStringPref("voice.tts.provider", "piper-local")
    );
    
    this.#commandExecutor = new CommandExecutor();
  }
  
  async startListening() {
    this.#state = "listening";
    this.#sttProvider.start();
    
    for await (const transcript of this.#sttProvider.transcribe()) {
      if (transcript.isFinal) {
        await this.#processCommand(transcript.text);
      } else {
        this.#emitInterimTranscript(transcript.text);
      }
    }
  }
  
  async #processCommand(text) {
    this.#state = "processing";
    
    // Try built-in commands first
    const builtInResult = await this.#commandExecutor.tryBuiltIn(text);
    if (builtInResult.handled) {
      await this.#speak(builtInResult.response);
      return;
    }
    
    // Fall back to LLM for complex queries
    const llmResponse = await this.#llmProvider.generate({
      systemPrompt: this.#getSystemPrompt(),
      userMessage: text,
      context: this.#getContext()
    });
    
    // Execute any actions from LLM response
    if (llmResponse.actions) {
      for (const action of llmResponse.actions) {
        await this.#commandExecutor.execute(action);
      }
    }
    
    await this.#speak(llmResponse.text);
  }
}
```

#### 2. Provider Interface

```javascript
// browser/components/voiceassistant/providers/STTProvider.sys.mjs

export class STTProvider {
  static get name() { throw new Error("Not implemented"); }
  static get isLocal() { throw new Error("Not implemented"); }
  
  async initialize(config) { throw new Error("Not implemented"); }
  start() { throw new Error("Not implemented"); }
  stop() { throw new Error("Not implemented"); }
  async *transcribe() { throw new Error("Not implemented"); }
}

// Local Whisper implementation
export class WhisperSTTProvider extends STTProvider {
  static get name() { return "whisper-local"; }
  static get isLocal() { return true; }
  
  #whisperModule = null;
  #audioCapture = null;
  
  async initialize(config) {
    // Load WASM Whisper module
    this.#whisperModule = await import(
      "resource://gre/modules/whisper/whisper.mjs"
    );
    await this.#whisperModule.load(config.model || "base.en");
  }
  
  async *transcribe() {
    const audioStream = this.#audioCapture.getStream();
    
    for await (const audioChunk of audioStream) {
      const result = await this.#whisperModule.transcribe(audioChunk);
      yield {
        text: result.text,
        confidence: result.confidence,
        isFinal: result.isFinal
      };
    }
  }
}
```

#### 3. Command Framework

```javascript
// browser/components/voiceassistant/commands/CommandRegistry.sys.mjs

export class CommandRegistry {
  #commands = new Map();
  
  register(pattern, handler, options = {}) {
    this.#commands.set(pattern, {
      handler,
      category: options.category || "general",
      description: options.description || "",
      examples: options.examples || [],
      requiresPermission: options.requiresPermission || null
    });
  }
  
  async match(utterance) {
    for (const [pattern, command] of this.#commands) {
      const match = this.#matchPattern(utterance, pattern);
      if (match) {
        return { command, params: match.params };
      }
    }
    return null;
  }
}

// Built-in browser commands
export function registerBrowserCommands(registry) {
  // Navigation
  registry.register(
    "go to {url}",
    async ({ url }) => {
      gBrowser.loadURI(Services.io.newURI(url));
      return { response: `Navigating to ${url}` };
    },
    {
      category: "navigation",
      description: "Navigate to a URL",
      examples: ["go to mozilla.org", "go to github.com"]
    }
  );
  
  // Tab management
  registry.register(
    "open new tab",
    async () => {
      gBrowser.addTrustedTab("about:newtab");
      return { response: "Opened a new tab" };
    },
    { category: "tabs", description: "Open a new tab" }
  );
  
  registry.register(
    "close tab",
    async () => {
      gBrowser.removeCurrentTab();
      return { response: "Closed the current tab" };
    },
    { category: "tabs", description: "Close the current tab" }
  );
  
  // Search
  registry.register(
    "search for {query}",
    async ({ query }) => {
      const searchService = Services.search.defaultEngine;
      const url = searchService.getSubmission(query).uri.spec;
      gBrowser.loadURI(Services.io.newURI(url));
      return { response: `Searching for ${query}` };
    },
    {
      category: "search",
      description: "Search the web",
      examples: ["search for firefox", "search for weather"]
    }
  );
  
  // Bookmarks
  registry.register(
    "bookmark this page",
    async () => {
      const uri = gBrowser.currentURI;
      const title = gBrowser.contentTitle;
      await PlacesUtils.bookmarks.insert({
        parentGuid: PlacesUtils.bookmarks.unfiledGuid,
        url: uri,
        title: title
      });
      return { response: `Bookmarked "${title}"` };
    },
    { category: "bookmarks", description: "Bookmark the current page" }
  );
  
  // History
  registry.register(
    "go back",
    async () => {
      gBrowser.goBack();
      return { response: "Going back" };
    },
    { category: "navigation", description: "Go to the previous page" }
  );
  
  // Accessibility
  registry.register(
    "read page",
    async () => {
      ReaderMode.enterReaderMode(gBrowser.selectedTab);
      // Trigger read aloud
      return { response: "Reading page content" };
    },
    { category: "accessibility", description: "Read the current page aloud" }
  );
}
```

---

## User Interface

### Voice Button in Toolbar

```css
/* browser/themes/shared/voiceassistant/voiceassistant.css */

#voice-assistant-button {
  list-style-image: url("chrome://browser/skin/voice-assistant.svg");
}

#voice-assistant-button[listening="true"] {
  list-style-image: url("chrome://browser/skin/voice-assistant-active.svg");
  animation: pulse 1s infinite;
}

#voice-assistant-button[speaking="true"] {
  list-style-image: url("chrome://browser/skin/voice-assistant-speaking.svg");
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

### Voice Assistant Panel

```xhtml
<!-- browser/components/voiceassistant/content/voiceassistant-panel.xhtml -->
<panel id="voice-assistant-panel" type="arrow">
  <vbox class="voice-assistant-content">
    <!-- Status indicator -->
    <hbox id="voice-status">
      <image id="voice-status-icon" />
      <label id="voice-status-text">Ready to listen</label>
    </hbox>
    
    <!-- Transcript display -->
    <vbox id="voice-transcript">
      <label class="interim-text"></label>
      <label class="final-text"></label>
    </vbox>
    
    <!-- Response display -->
    <vbox id="voice-response">
      <label class="response-text"></label>
    </vbox>
    
    <!-- Quick commands -->
    <hbox id="voice-quick-commands">
      <button label="Help" oncommand="VoiceAssistant.showHelp()" />
      <button label="Settings" oncommand="openPreferences('voice')" />
    </hbox>
  </vbox>
</panel>
```

---

## Preferences

```javascript
// browser/components/voiceassistant/VoiceAssistantPrefs.sys.mjs

export const VoiceAssistantPrefs = {
  // Provider settings
  "voice.stt.provider": "whisper-local",
  "voice.stt.language": "en-US",
  "voice.stt.model": "base.en",
  
  "voice.llm.provider": "local-llama",
  "voice.llm.model": "llama-3.2-3b",
  "voice.llm.endpoint": "",  // For cloud providers
  
  "voice.tts.provider": "piper-local",
  "voice.tts.voice": "en_US-lessac-medium",
  "voice.tts.rate": 1.0,
  "voice.tts.pitch": 1.0,
  
  // Privacy settings
  "voice.privacy.localOnly": true,
  "voice.privacy.saveHistory": false,
  "voice.privacy.telemetry": false,
  
  // Behavior settings
  "voice.behavior.wakeWord": "",  // Empty = manual activation
  "voice.behavior.autoStop": true,
  "voice.behavior.silenceTimeout": 2000,
  
  // Accessibility settings
  "voice.accessibility.screenReaderAnnounce": true,
  "voice.accessibility.visualFeedback": true,
  "voice.accessibility.hapticFeedback": true,
};
```

### Preferences UI

```xhtml
<!-- browser/components/preferences/voice.xhtml -->
<hbox id="voiceCategory" class="subcategory">
  <h2 data-l10n-id="voice-header" />
</hbox>

<groupbox id="voiceProviders">
  <label><h3 data-l10n-id="voice-providers-header" /></label>
  
  <!-- STT Provider -->
  <hbox class="voice-provider-row">
    <label data-l10n-id="voice-stt-provider" />
    <menulist id="voice-stt-provider" preference="voice.stt.provider">
      <menupopup>
        <menuitem value="whisper-local" label="Whisper (Local)" />
        <menuitem value="deepgram" label="Deepgram (Cloud)" />
        <menuitem value="google" label="Google (Cloud)" />
      </menupopup>
    </menulist>
  </hbox>
  
  <!-- LLM Provider -->
  <hbox class="voice-provider-row">
    <label data-l10n-id="voice-llm-provider" />
    <menulist id="voice-llm-provider" preference="voice.llm.provider">
      <menupopup>
        <menuitem value="local-llama" label="Llama (Local)" />
        <menuitem value="groq" label="Groq (Cloud)" />
        <menuitem value="openai" label="OpenAI (Cloud)" />
      </menupopup>
    </menulist>
  </hbox>
</groupbox>

<groupbox id="voicePrivacy">
  <label><h3 data-l10n-id="voice-privacy-header" /></label>
  
  <checkbox id="voice-local-only"
            preference="voice.privacy.localOnly"
            data-l10n-id="voice-local-only" />
  
  <checkbox id="voice-save-history"
            preference="voice.privacy.saveHistory"
            data-l10n-id="voice-save-history" />
</groupbox>
```

---

## Privacy & Security

### Privacy Principles

1. **Local by Default**: Speech recognition and LLM run locally unless user opts in to cloud
2. **No Data Collection**: Voice data never sent to Mozilla servers
3. **Transparent Cloud Usage**: Clear indication when cloud services are used
4. **User Control**: Easy toggle between local and cloud processing
5. **Data Deletion**: Simple way to delete any stored voice data

### Security Measures

```javascript
// Security policy for voice commands
const VoiceSecurityPolicy = {
  // Commands that can execute without confirmation
  safeCommands: [
    "navigation",
    "tabs",
    "search",
    "bookmarks",
    "history"
  ],
  
  // Commands requiring user confirmation
  sensitiveCommands: [
    "form-fill",
    "password-management",
    "downloads",
    "extensions"
  ],
  
  // Commands that are never allowed via voice
  blockedCommands: [
    "about:config",
    "browser-internal",
    "system-access"
  ],
  
  // Rate limiting
  maxCommandsPerMinute: 30,
  maxCloudRequestsPerHour: 100
};
```

---

## Accessibility

### Screen Reader Integration

```javascript
// Announce voice assistant state changes to screen readers
function announceToScreenReader(message, priority = "polite") {
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", priority);
  announcement.setAttribute("aria-atomic", "true");
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 1000);
}
```

### Keyboard Accessibility

```javascript
// Keyboard shortcuts for voice assistant
const VoiceKeyboardShortcuts = {
  // Toggle voice assistant
  "Ctrl+Shift+V": () => VoiceAssistant.toggle(),
  
  // Stop listening
  "Escape": () => VoiceAssistant.stop(),
  
  // Repeat last response
  "Ctrl+Shift+R": () => VoiceAssistant.repeatLast(),
  
  // Open voice settings
  "Ctrl+Shift+,": () => openPreferences("voice")
};
```

---

## Implementation Plan

### Phase 1: Foundation (Months 1-3)
- [ ] Set up Voice Assistant module structure
- [ ] Implement local Whisper STT provider
- [ ] Implement basic browser commands
- [ ] Create toolbar button and panel UI

### Phase 2: AI Integration (Months 4-6)
- [ ] Integrate local Llama LLM
- [ ] Add cloud provider options
- [ ] Implement TTS with Piper
- [ ] Advanced command processing

### Phase 3: Polish & Testing (Months 7-9)
- [ ] Accessibility review and fixes
- [ ] Security audit
- [ ] Performance optimization
- [ ] Localization

### Phase 4: Launch (Months 10-12)
- [ ] Beta release in Nightly
- [ ] Collect feedback
- [ ] Iterate and fix issues
- [ ] Stable release

---

## Resources Required

- 2-3 full-time engineers
- 1 UX designer
- 1 security reviewer
- Access to Mozilla's ML infrastructure
- Community volunteers for testing

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Daily Active Users | 100,000 | Telemetry |
| Command Success Rate | > 90% | Local analytics |
| Local Processing Usage | > 80% | Telemetry |
| User Satisfaction | > 4/5 | Surveys |
| Accessibility Compliance | WCAG 2.1 AA | Audit |

---

## Contact

- Bugzilla: https://bugzilla.mozilla.org
- Matrix: #voice:mozilla.org
- Mailing List: dev-platform@lists.mozilla.org

---

## Appendix: Full Command List

| Command | Category | Description |
|---------|----------|-------------|
| "go to {url}" | Navigation | Navigate to URL |
| "go back" | Navigation | Go to previous page |
| "go forward" | Navigation | Go to next page |
| "refresh" | Navigation | Reload current page |
| "open new tab" | Tabs | Open new tab |
| "close tab" | Tabs | Close current tab |
| "switch to tab {n}" | Tabs | Switch to tab number |
| "search for {query}" | Search | Web search |
| "find {text}" | Search | Find on page |
| "bookmark this" | Bookmarks | Bookmark current page |
| "show bookmarks" | Bookmarks | Open bookmarks |
| "zoom in" | View | Increase zoom |
| "zoom out" | View | Decrease zoom |
| "full screen" | View | Toggle full screen |
| "read page" | Accessibility | Read page aloud |
| "stop reading" | Accessibility | Stop reading |
| "help" | General | Show available commands |
