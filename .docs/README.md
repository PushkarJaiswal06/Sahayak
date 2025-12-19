# Sahayak Open Source Contribution Documentation

This directory contains all documentation for contributing Sahayak's voice-first agent technology to major open source projects.

## 📁 Documentation Structure

```
.docs/
├── README.md                           # This file (index)
├── CONTRIBUTION_STRATEGY.md            # Overall strategy and target projects
├── ARCHITECTURE.md                     # Technical architecture overview
│
├── proposals/                          # Feature proposals for different projects
│   ├── web-speech-api-enhancement.md   # W3C Web Speech API proposal
│   ├── chromium-voice-agent.md         # Chromium/V8 integration proposal
│   ├── firefox-voice-assistant.md      # Mozilla Firefox proposal
│   └── electron-voice-sdk.md           # Electron voice SDK proposal
│
├── components/                         # Technical component specifications
│   ├── voice-agent-core.md             # Core agent abstraction & interfaces
│   ├── streaming-stt-protocol.md       # Real-time STT WebSocket protocol
│   ├── action-plan-schema.md           # Agent action plan JSON schema
│   └── tts-synthesis-api.md            # TTS synthesis API specification
│
├── guides/                             # Step-by-step contribution guides
│   ├── chromium-contribution-guide.md  # How to contribute to Chromium
│   ├── mozilla-contribution-guide.md   # How to contribute to Firefox
│   └── w3c-proposal-process.md         # W3C specification process
│
└── examples/                           # Implementation examples
    ├── browser-extension/              # Chrome/Firefox browser extension
    │   └── README.md                   # Full implementation guide
    ├── web-component/                  # <voice-agent> custom element
    │   └── README.md                   # Web component documentation
    └── node-sdk/                       # Node.js SDK for server-side
        └── README.md                   # SDK documentation & examples
```

## 🎯 Contribution Targets

| Project | Component | Status | Priority | Docs |
|---------|-----------|--------|----------|------|
| W3C Web Speech API | Enhanced streaming STT | ✅ Proposal Ready | High | [Proposal](proposals/web-speech-api-enhancement.md) |
| Chromium | Voice Agent API | ✅ Proposal Ready | High | [Proposal](proposals/chromium-voice-agent.md) |
| Mozilla Firefox | Voice Assistant Integration | ✅ Proposal Ready | High | [Proposal](proposals/firefox-voice-assistant.md) |
| Electron | Voice SDK | ✅ Proposal Ready | Medium | [Proposal](proposals/electron-voice-sdk.md) |
| VS Code | Voice Coding Extension | 📋 Planned | Medium | - |
| Node.js | Voice Agent Module | ✅ Example Ready | Medium | [Example](examples/node-sdk/README.md) |

## 📚 Documentation Overview

### Strategy & Architecture
- **[CONTRIBUTION_STRATEGY.md](./CONTRIBUTION_STRATEGY.md)** - Master plan covering target projects, timelines, and phases
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technical architecture for abstracting Sahayak into reusable components

### Feature Proposals
- **[Web Speech API Enhancement](proposals/web-speech-api-enhancement.md)** - Extending the W3C Web Speech API with streaming and custom providers
- **[Chromium Voice Agent](proposals/chromium-voice-agent.md)** - Native `navigator.voiceAgent` API for Chrome
- **[Firefox Voice Assistant](proposals/firefox-voice-assistant.md)** - Privacy-focused voice assistant for Firefox
- **[Electron Voice SDK](proposals/electron-voice-sdk.md)** - Official voice SDK for Electron apps

### Technical Components
- **[Voice Agent Core](components/voice-agent-core.md)** - Core TypeScript interfaces and implementation
- **[Streaming STT Protocol](components/streaming-stt-protocol.md)** - WebSocket protocol for real-time speech-to-text
- **[Action Plan Schema](components/action-plan-schema.md)** - JSON schema for structured agent responses
- **[TTS Synthesis API](components/tts-synthesis-api.md)** - Text-to-speech provider abstraction

### Contribution Guides
- **[Chromium Guide](guides/chromium-contribution-guide.md)** - Step-by-step guide to contributing to Chromium
- **[Mozilla Guide](guides/mozilla-contribution-guide.md)** - Guide to contributing to Firefox/Gecko
- **[W3C Process](guides/w3c-proposal-process.md)** - How to propose and champion web standards

### Implementation Examples
- **[Browser Extension](examples/browser-extension/README.md)** - Complete Chrome/Firefox extension example
- **[Web Component](examples/web-component/README.md)** - `<voice-agent>` custom element implementation
- **[Node.js SDK](examples/node-sdk/README.md)** - Server-side voice agent with WebSocket, Twilio integration

## 🚀 Getting Started

### For Contributors
1. Read [CONTRIBUTION_STRATEGY.md](./CONTRIBUTION_STRATEGY.md) to understand the vision
2. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for technical context
3. Pick a target project and study its proposal in `proposals/`
4. Follow the contribution guide in `guides/`

### For Implementers
1. Start with [Voice Agent Core](components/voice-agent-core.md) for the TypeScript API
2. Review the examples in `examples/` for your platform
3. Use the component specs for integration details

## 📊 Progress Tracking

### Phase 1: Foundation (Completed ✅)
- [x] Create documentation structure
- [x] Write contribution strategy
- [x] Define technical architecture
- [x] Create all feature proposals
- [x] Write component specifications
- [x] Create contribution guides
- [x] Build example implementations

### Phase 2: Abstraction (Next)
- [ ] Extract `@sahayak/voice-agent-core` package from Sahayak
- [ ] Create `@sahayak/voice-agent-element` web component
- [ ] Publish packages to npm
- [ ] Build working browser extension demo

### Phase 3: Engagement
- [ ] Submit W3C WICG explainer
- [ ] Create Chromium feature request
- [ ] Engage with Mozilla voice team
- [ ] Propose Electron voice SDK RFC

### Phase 4: Integration
- [ ] Implement Chromium Voice Agent API prototype
- [ ] Contribute to Firefox voice features
- [ ] Build VS Code voice extension
- [ ] Create comprehensive test suite

## 🏗️ Package Structure (Planned)

```
@sahayak/
├── voice-agent-core     # Core library (Node.js + Browser)
├── voice-agent-element  # Web Component
├── voice-agent-node     # Node.js SDK with audio I/O
├── stt-client           # Standalone STT client
├── tts-client           # Standalone TTS client
└── voice-protocol       # Protocol definitions & schemas
```

## 🤝 How to Contribute

1. **Documentation**: Improve existing docs or add new guides
2. **Code**: Help extract Sahayak core into standalone packages
3. **Standards**: Participate in W3C discussions
4. **Browser Contributions**: Submit patches to Chromium/Firefox
5. **Testing**: Build test suites and demos

## 📞 Contact

- **Project**: Sahayak Voice Agent
- **Repository**: [github.com/your-repo/sahayak](https://github.com/your-repo/sahayak)
- **Issues**: Use GitHub Issues for discussions

---

*This documentation is part of the Sahayak project - a voice-first agentic banking platform demonstrating the future of conversational AI interfaces.*
