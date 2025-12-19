# Chromium Voice Agent API Proposal

## Feature: Native Voice Agent API for Chrome/Chromium

**Status**: Draft  
**Author**: Sahayak Team  
**Component**: Blink > Speech  
**Bug Tracker**: https://bugs.chromium.org  

---

## Summary

Add a native Voice Agent API to Chromium that enables web applications to create conversational AI experiences with proper permission models, security boundaries, and integration with the browser's existing speech capabilities.

---

## Motivation

### Problem

Building voice-first web applications today requires:
1. Multiple third-party services (STT, LLM, TTS)
2. Complex WebSocket management
3. Audio capture and processing workarounds
4. No standardized permission model for voice agents
5. Poor integration with browser accessibility features

### Solution

A native `navigator.voiceAgent` API that:
1. Provides unified voice agent capabilities
2. Integrates with existing browser permissions
3. Enables secure communication with AI backends
4. Supports both online and offline voice processing

---

## Proposed API

### 1. VoiceAgent Interface

```webidl
[Exposed=Window, SecureContext]
interface VoiceAgent : EventTarget {
  constructor(VoiceAgentOptions options);
  
  // State
  readonly attribute VoiceAgentState state;
  readonly attribute boolean isListening;
  readonly attribute boolean isSpeaking;
  
  // Control
  Promise<void> start();
  Promise<void> stop();
  Promise<void> pause();
  Promise<void> resume();
  
  // Speech
  Promise<void> speak(DOMString text, optional SpeakOptions options);
  Promise<void> stopSpeaking();
  
  // Context
  void setContext(object context);
  void clearContext();
  
  // Events
  attribute EventHandler onstart;
  attribute EventHandler onstop;
  attribute EventHandler ontranscript;
  attribute EventHandler onresponse;
  attribute EventHandler onaction;
  attribute EventHandler onerror;
  attribute EventHandler onstatechange;
};

enum VoiceAgentState {
  "idle",
  "listening",
  "processing",
  "speaking",
  "error"
};
```

### 2. Configuration Options

```webidl
dictionary VoiceAgentOptions {
  // Speech Recognition
  DOMString language = "en-US";
  boolean continuous = true;
  boolean interimResults = true;
  
  // AI Backend
  DOMString aiProviderUrl;
  DOMString aiModel;
  DOMString systemPrompt;
  
  // Text-to-Speech
  DOMString voice;
  float rate = 1.0;
  float pitch = 1.0;
  
  // Permissions
  sequence<VoiceAgentCapability> capabilities;
  
  // Privacy
  boolean localProcessingOnly = false;
  boolean saveTranscripts = false;
};

enum VoiceAgentCapability {
  "navigation",      // Navigate to URLs
  "domInteraction",  // Click, type, scroll
  "clipboard",       // Copy/paste
  "notifications",   // Show notifications
  "storage",         // Access localStorage
  "apiCalls",        // Make fetch requests
  "accessibility"    // Control accessibility features
};
```

### 3. Events

```webidl
[Exposed=Window]
interface VoiceAgentTranscriptEvent : Event {
  readonly attribute DOMString transcript;
  readonly attribute float confidence;
  readonly attribute boolean isFinal;
};

[Exposed=Window]
interface VoiceAgentResponseEvent : Event {
  readonly attribute DOMString text;
  readonly attribute object actionPlan;
  readonly attribute DOMString intent;
  readonly attribute float confidence;
};

[Exposed=Window]
interface VoiceAgentActionEvent : Event {
  readonly attribute DOMString actionType;
  readonly attribute object actionParams;
  readonly attribute boolean requiresConfirmation;
  
  void confirm();
  void cancel();
};
```

---

## Usage Examples

### Basic Voice Assistant

```javascript
const agent = new VoiceAgent({
  language: 'en-US',
  aiProviderUrl: 'wss://api.example.com/agent',
  systemPrompt: 'You are a helpful assistant for this website.',
  capabilities: ['navigation', 'domInteraction']
});

agent.ontranscript = (e) => {
  if (!e.isFinal) {
    showInterimText(e.transcript);
  }
};

agent.onresponse = (e) => {
  console.log('AI Response:', e.text);
};

agent.onaction = (e) => {
  if (e.requiresConfirmation) {
    if (confirm(`Allow: ${e.actionType}?`)) {
      e.confirm();
    } else {
      e.cancel();
    }
  }
};

// Start listening
document.getElementById('mic-btn').onclick = () => agent.start();
```

### Voice-Controlled Navigation

```javascript
const agent = new VoiceAgent({
  capabilities: ['navigation'],
  systemPrompt: `
    You are a navigation assistant for an e-commerce site.
    Available pages: Home (/), Products (/products), Cart (/cart), Account (/account)
    Respond with navigation actions when appropriate.
  `
});

agent.onaction = (e) => {
  if (e.actionType === 'navigation') {
    window.location.href = e.actionParams.url;
  }
};
```

### Accessibility Voice Control

```javascript
const agent = new VoiceAgent({
  capabilities: ['accessibility', 'domInteraction'],
  systemPrompt: 'Help users navigate this page using voice commands.',
  localProcessingOnly: true  // Privacy-focused
});

agent.onaction = async (e) => {
  switch (e.actionType) {
    case 'click':
      document.querySelector(e.actionParams.selector)?.click();
      break;
    case 'scroll':
      window.scrollBy(0, e.actionParams.amount);
      break;
    case 'focus':
      document.querySelector(e.actionParams.selector)?.focus();
      break;
  }
};
```

---

## Permission Model

### Permission Types

```javascript
// New permission type
const permission = await navigator.permissions.query({
  name: 'voice-agent',
  capabilities: ['navigation', 'domInteraction']
});
```

### Permission Dialog

When a site requests voice agent access, Chrome shows:

```
┌─────────────────────────────────────────────────────────┐
│  🎤 example.com wants to use Voice Agent                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  This will allow the site to:                          │
│                                                         │
│  ✓ Use your microphone for voice input                 │
│  ✓ Navigate to different pages                         │
│  ✓ Interact with page elements                         │
│                                                         │
│  Your voice data will be sent to:                      │
│  api.example.com                                        │
│                                                         │
│  [Block]                              [Allow]           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Permission Policies

```http
Permissions-Policy: voice-agent=(self "https://trusted-ai.com")
```

---

## Security Considerations

### 1. Secure Context Required

Voice Agent API only available in secure contexts (HTTPS).

### 2. Content Security Policy

```http
Content-Security-Policy: 
  connect-src 'self' wss://api.example.com;
  voice-agent-src 'self' https://ai-provider.com;
```

### 3. Action Sandboxing

```javascript
// Actions are sandboxed and require explicit capabilities
agent.onaction = (e) => {
  // This will fail if 'apiCalls' capability not granted
  if (e.actionType === 'apiCall') {
    // Browser validates against granted capabilities
  }
};
```

### 4. Rate Limiting

- Max 10 actions per second
- Max 100 API calls per minute
- Cooldown after excessive requests

### 5. Audit Logging

```javascript
// Available in DevTools
chrome.voiceAgent.getAuditLog().then(log => {
  console.log(log);
  // [{ timestamp, action, params, result }]
});
```

---

## Implementation Plan

### Phase 1: Foundation (Q1)
- [ ] Implement `VoiceAgent` interface
- [ ] Add permission model
- [ ] Basic speech recognition integration
- [ ] TTS integration with `speechSynthesis`

### Phase 2: AI Integration (Q2)
- [ ] WebSocket provider support
- [ ] Action plan parsing
- [ ] DOM interaction capabilities
- [ ] Navigation capabilities

### Phase 3: Security & Polish (Q3)
- [ ] Complete security audit
- [ ] DevTools integration
- [ ] Performance optimization
- [ ] Documentation

### Phase 4: Launch (Q4)
- [ ] Origin trial
- [ ] Feedback collection
- [ ] Iterate based on feedback
- [ ] Stable release

---

## Testing Plan

### Unit Tests
- VoiceAgent state machine
- Permission checks
- Action validation
- Event dispatching

### Integration Tests
- Speech recognition integration
- TTS integration
- WebSocket provider communication
- Cross-origin security

### Web Platform Tests
- Conformance tests for all APIs
- Permission policy tests
- Secure context enforcement

---

## Alternatives Considered

### 1. Extend Web Speech API
**Rejected**: Web Speech API is focused on speech recognition/synthesis, not agent orchestration.

### 2. Browser Extension API
**Rejected**: Extensions have different security model, not suitable for web apps.

### 3. Service Worker Based
**Rejected**: Service workers can't access microphone, requires main thread.

---

## References

1. [Web Speech API](https://wicg.github.io/speech-api/)
2. [Permissions API](https://www.w3.org/TR/permissions/)
3. [Content Security Policy](https://www.w3.org/TR/CSP3/)
4. [Chrome Extensions API](https://developer.chrome.com/docs/extensions/)

---

## Contact

- Blink-dev mailing list: blink-dev@chromium.org
- Feature owner: [TBD]
- Bug: [TBD - to be filed]

---

## Appendix: Full IDL

```webidl
// voice-agent.idl

[Exposed=Window, SecureContext]
interface VoiceAgentManager {
  Promise<VoiceAgent> create(VoiceAgentOptions options);
  Promise<PermissionState> requestPermission(VoiceAgentPermissionDescriptor descriptor);
  boolean isSupported();
};

partial interface Navigator {
  [SameObject] readonly attribute VoiceAgentManager voiceAgent;
};

[Exposed=Window, SecureContext]
interface VoiceAgent : EventTarget {
  constructor(VoiceAgentOptions options);
  
  readonly attribute VoiceAgentState state;
  readonly attribute boolean isListening;
  readonly attribute boolean isSpeaking;
  readonly attribute FrozenArray<VoiceAgentCapability> grantedCapabilities;
  
  Promise<void> start();
  Promise<void> stop();
  Promise<void> pause();
  Promise<void> resume();
  
  Promise<void> speak(DOMString text, optional SpeakOptions options = {});
  Promise<void> stopSpeaking();
  
  void setContext(object context);
  void addMessage(VoiceAgentMessage message);
  void clearContext();
  
  attribute EventHandler onstart;
  attribute EventHandler onstop;
  attribute EventHandler ontranscript;
  attribute EventHandler onresponse;
  attribute EventHandler onaction;
  attribute EventHandler onerror;
  attribute EventHandler onstatechange;
};

dictionary VoiceAgentOptions {
  DOMString language = "en-US";
  boolean continuous = true;
  boolean interimResults = true;
  DOMString aiProviderUrl;
  DOMString aiModel;
  DOMString systemPrompt;
  DOMString voice;
  float rate = 1.0;
  float pitch = 1.0;
  float volume = 1.0;
  sequence<VoiceAgentCapability> capabilities = [];
  boolean localProcessingOnly = false;
  boolean saveTranscripts = false;
  unsigned long maxHistoryLength = 50;
};

dictionary SpeakOptions {
  DOMString voice;
  float rate;
  float pitch;
  float volume;
  boolean interrupt = true;
};

dictionary VoiceAgentMessage {
  required DOMString role;
  required DOMString content;
};

dictionary VoiceAgentPermissionDescriptor : PermissionDescriptor {
  sequence<VoiceAgentCapability> capabilities = [];
};

enum VoiceAgentState {
  "idle",
  "listening",
  "processing",
  "speaking",
  "paused",
  "error"
};

enum VoiceAgentCapability {
  "navigation",
  "domInteraction",
  "clipboard",
  "notifications",
  "storage",
  "apiCalls",
  "accessibility",
  "forms",
  "media"
};

[Exposed=Window]
interface VoiceAgentTranscriptEvent : Event {
  constructor(DOMString type, VoiceAgentTranscriptEventInit eventInitDict);
  readonly attribute DOMString transcript;
  readonly attribute float confidence;
  readonly attribute boolean isFinal;
  readonly attribute DOMHighResTimeStamp timestamp;
};

dictionary VoiceAgentTranscriptEventInit : EventInit {
  DOMString transcript = "";
  float confidence = 0.0;
  boolean isFinal = false;
  DOMHighResTimeStamp timestamp = 0;
};

[Exposed=Window]
interface VoiceAgentResponseEvent : Event {
  constructor(DOMString type, VoiceAgentResponseEventInit eventInitDict);
  readonly attribute DOMString text;
  readonly attribute object? actionPlan;
  readonly attribute DOMString? intent;
  readonly attribute float confidence;
};

dictionary VoiceAgentResponseEventInit : EventInit {
  DOMString text = "";
  object? actionPlan = null;
  DOMString? intent = null;
  float confidence = 0.0;
};

[Exposed=Window]
interface VoiceAgentActionEvent : Event {
  constructor(DOMString type, VoiceAgentActionEventInit eventInitDict);
  readonly attribute DOMString actionType;
  readonly attribute object actionParams;
  readonly attribute boolean requiresConfirmation;
  readonly attribute DOMString? confirmationMessage;
  
  void confirm();
  void cancel();
};

dictionary VoiceAgentActionEventInit : EventInit {
  DOMString actionType = "";
  object actionParams;
  boolean requiresConfirmation = false;
  DOMString? confirmationMessage = null;
};
```
