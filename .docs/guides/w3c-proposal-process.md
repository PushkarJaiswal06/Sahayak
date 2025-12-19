# W3C Specification Proposal Process

## How to Propose Web Standards to W3C

This guide explains the process of proposing new web standards or extensions to existing standards through the World Wide Web Consortium (W3C).

---

## Overview of W3C Process

### Stages of a Web Standard

```
┌─────────────────┐
│   Idea/Need     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Incubation      │  ← Community Groups (WICG)
│ (Explainer)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Working Draft   │  ← Working Group
│ (FPWD)          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Candidate       │  ← Implementation feedback
│ Recommendation  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Proposed        │  ← Final review
│ Recommendation  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ W3C             │  ← Official standard
│ Recommendation  │
└─────────────────┘
```

---

## Step 1: Research Existing Work

Before proposing anything new, research existing specifications:

### Relevant Specifications

- **Web Speech API**: https://wicg.github.io/speech-api/
- **MediaStream Recording**: https://www.w3.org/TR/mediastream-recording/
- **Web Audio API**: https://www.w3.org/TR/webaudio/
- **Permissions API**: https://www.w3.org/TR/permissions/

### Check for Existing Proposals

1. **WICG (Web Incubator CG)**: https://github.com/WICG
2. **W3C GitHub**: https://github.com/w3c
3. **TAG Design Reviews**: https://github.com/w3ctag/design-reviews/issues

---

## Step 2: Write an Explainer

An explainer is a document that describes the problem and proposed solution in plain language.

### Explainer Template

```markdown
# Voice Agent API Explainer

## Authors
- [Your Name] ([Organization])

## Participate
- [GitHub Repository]
- [Issue Tracker]

## Introduction

[Brief description of the problem and solution]

The Voice Agent API enables web applications to create conversational AI
experiences by combining speech recognition, natural language processing,
and speech synthesis with proper permission models.

## Goals

- Enable voice-first web applications
- Provide standardized voice agent capabilities
- Ensure user privacy and security
- Support accessibility use cases

## Non-Goals

- Replace existing Web Speech API (extend it)
- Provide AI/ML inference capabilities (use external services)
- Define specific AI providers (provider-agnostic)

## User Research

[Evidence that this feature is needed]

- X% of users prefer voice interaction for certain tasks
- Growing adoption of voice assistants (Siri, Alexa, Google Assistant)
- Accessibility benefits for users with motor impairments

## Use Cases

### Use Case 1: Voice-Controlled Web App

A user wants to navigate a complex web application using voice commands:

```javascript
const agent = new VoiceAgent({
  capabilities: ['navigation', 'search']
});

agent.start();
// User says: "Go to settings"
// App navigates to settings page
```

### Use Case 2: Voice Banking

A user wants to check their bank balance:

```javascript
const agent = new VoiceAgent({
  aiProviderUrl: 'wss://bank.example/voice-agent',
  capabilities: ['read', 'action']
});

agent.on('action', (action) => {
  if (action.type === 'read-balance') {
    speakBalance(action.params.accountId);
  }
});
```

## Proposed API

### Interface

```webidl
[Exposed=Window, SecureContext]
interface VoiceAgent : EventTarget {
  constructor(VoiceAgentOptions options);
  
  readonly attribute VoiceAgentState state;
  
  Promise<void> start();
  Promise<void> stop();
  Promise<void> speak(DOMString text);
  
  attribute EventHandler ontranscript;
  attribute EventHandler onresponse;
  attribute EventHandler onaction;
};
```

### Example Usage

```javascript
const agent = new VoiceAgent({
  language: 'en-US',
  aiProviderUrl: 'wss://api.example.com/agent'
});

agent.ontranscript = (e) => {
  console.log('User said:', e.transcript);
};

agent.onresponse = (e) => {
  console.log('AI responded:', e.text);
};

await agent.start();
```

## Key Scenarios

### Scenario 1: Permission Grant

1. Website calls `new VoiceAgent(options)`
2. Browser checks `voice-agent` permission
3. If not granted, browser shows permission prompt
4. User grants or denies permission
5. If granted, agent initializes

### Scenario 2: Custom AI Provider

1. Website specifies `aiProviderUrl` in options
2. Agent connects to WebSocket endpoint
3. Audio is streamed to provider for STT
4. Transcripts are sent to provider's LLM
5. Responses are returned and spoken via TTS

## Detailed Design

### Permission Model

The Voice Agent API requires explicit user permission:

```javascript
const status = await navigator.permissions.query({
  name: 'voice-agent',
  capabilities: ['navigation', 'read']
});
```

### Security Considerations

1. **Secure Context Required**: API only available over HTTPS
2. **User Activation**: May require user gesture to start
3. **CSP Integration**: Providers controlled via CSP
4. **Rate Limiting**: Built-in rate limiting for actions

### Privacy Considerations

1. **Local Processing Option**: Browser can process locally
2. **Data Minimization**: Only necessary data sent to providers
3. **Clear Indicator**: Visual indicator when listening
4. **User Control**: Easy way to stop and disable

## Alternatives Considered

### Alternative 1: Extend Web Speech API

**Pros:**
- Builds on existing API
- Less new surface area

**Cons:**
- Web Speech API is narrowly scoped
- Would require significant changes to existing implementations

### Alternative 2: Browser Extension Only

**Pros:**
- No web standard needed
- Faster iteration

**Cons:**
- Not available to all websites
- Inconsistent implementation

## Accessibility

The Voice Agent API improves accessibility by:

1. Enabling hands-free interaction
2. Supporting screen reader users
3. Providing alternative input methods
4. Reducing cognitive load for some users

## Internationalization

1. Support for multiple languages via `language` option
2. RTL text handling in UI elements
3. Cultural considerations in TTS voices

## Stakeholder Feedback

| Stakeholder | Feedback | Status |
|-------------|----------|--------|
| Chrome Team | Interested | Discussion |
| Firefox Team | Reviewing | Discussion |
| Safari Team | No response | Pending |
| Web developers | Strong interest | Positive |

## References

1. [Web Speech API](https://wicg.github.io/speech-api/)
2. [Permissions API](https://www.w3.org/TR/permissions/)
3. [Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/)
```

---

## Step 3: Join WICG

The Web Incubator Community Group (WICG) is where new ideas are incubated before becoming formal standards.

### Join WICG

1. Go to https://www.w3.org/community/wicg/
2. Click "Join this group"
3. Sign the W3C Community Contributor License Agreement

### Create a Repository

1. Fork the WICG proposal template
2. Create your proposal repository
3. Add explainer document
4. Add specification draft (optional at this stage)

```bash
# Create repository
gh repo create WICG/voice-agent --public
cd voice-agent

# Add files
touch README.md
touch explainer.md
touch index.bs  # Bikeshed specification

# Initial commit
git add .
git commit -m "Initial proposal for Voice Agent API"
git push
```

---

## Step 4: Get Feedback

### Present to WICG

1. Join WICG meetings (schedule on w3.org)
2. Request time to present your proposal
3. Prepare a 10-15 minute presentation
4. Be ready for questions and feedback

### Request TAG Review

The W3C Technical Architecture Group reviews proposals for web platform compatibility:

1. Go to https://github.com/w3ctag/design-reviews
2. Create a new issue using the template
3. Include:
   - Link to explainer
   - Link to specification (if any)
   - Security and privacy questionnaire
   - Key design questions

### Security & Privacy Questionnaire

```markdown
# Security and Privacy Self-Review Questionnaire

## 2.1 What information might this feature expose to Web sites or other parties?

The Voice Agent API exposes:
- Audio from user's microphone (with permission)
- Speech-to-text transcriptions
- AI provider responses

## 2.2 Do features in your specification expose the minimum amount of information necessary?

Yes. The API:
- Only activates with explicit user permission
- Only streams audio when actively listening
- Does not expose raw audio to the page by default

## 2.3 How do the features in your specification deal with personal information?

- Audio is processed in real-time, not stored
- Transcripts are ephemeral unless page explicitly stores them
- Provider URLs are visible in CSP and permission prompts

## 2.4 How do the features in your specification deal with sensitive information?

- Permission prompt clearly indicates data will be sent to external service
- Visual indicator shows when microphone is active
- User can revoke permission at any time

## 2.5 Do the features in your specification introduce new state for an origin?

Yes, permission state is persisted per origin.

## 2.6 What information from the underlying platform is exposed?

- Available microphones (via existing getUserMedia)
- Available TTS voices (via existing speechSynthesis)

## 2.7 Does this specification allow an origin access to sensors?

Yes, microphone access (building on existing Media Capture API).

## 2.8 What data do the features in this specification expose to an origin?

- User's spoken words (transcribed)
- AI provider responses
- Action execution results

## 2.9 Do features in this specification enable new script execution/loading mechanisms?

No.

## 2.10 Do features in this specification allow an origin to access other devices?

No.

## 2.11 Do features in this specification allow an origin some measure of control over a user agent's native UI?

Yes:
- Shows permission prompt
- Shows listening indicator
- May show TTS playback controls

## 2.12 What temporary identifiers might this specification create or expose?

- Session IDs for AI provider connections
- Request IDs for individual interactions

## 2.13 How does this specification distinguish between behavior in first-party and third-party contexts?

Voice Agent requires first-party context (top-level browsing context).

## 2.14 How do the features in this specification work in the context of a user agent's Private Browsing mode?

- Permission not persisted in private mode
- No history saved
- Same functionality otherwise

## 2.15 Does this specification have both "Security Considerations" and "Privacy Considerations" sections?

Yes.

## 2.16 Do features in your specification enable downgrading default security characteristics?

No.

## 2.17 What should this questionnaire have asked?

- How do accessibility tools interact with this API?
- What happens if AI provider is malicious?
```

---

## Step 5: Write the Specification

### Use Bikeshed

Bikeshed is the preferred format for W3C specifications:

```bash
# Install Bikeshed
pip install bikeshed
bikeshed update

# Create specification
touch index.bs
```

### Specification Template

```bikeshed
<pre class='metadata'>
Title: Voice Agent API
Shortname: voice-agent
Level: 1
Status: CG-DRAFT
Group: WICG
URL: https://wicg.github.io/voice-agent/
Editor: Your Name, Organization, email@example.com
Abstract: This specification defines the Voice Agent API, which enables web applications to create conversational AI experiences.
Repository: WICG/voice-agent
Markup Shorthands: markdown yes
</pre>

<pre class="anchors">
urlPrefix: https://dom.spec.whatwg.org/; spec: DOM
    type: interface
        text: EventTarget; url: #eventtarget
urlPrefix: https://webidl.spec.whatwg.org/; spec: WEBIDL
    type: dfn
        text: identifier; url: #dfn-identifier
</pre>

# Introduction # {#intro}

The Voice Agent API provides web applications with the ability to create
conversational AI experiences using speech recognition, natural language
processing, and speech synthesis.

## Goals ## {#goals}

The primary goals of this API are:

1. Enable voice-first web applications
2. Provide standardized voice agent capabilities
3. Ensure user privacy and security
4. Support accessibility use cases

# API # {#api}

## The {{VoiceAgent}} interface ## {#voice-agent-interface}

<xmp class="idl">
[Exposed=Window, SecureContext]
interface VoiceAgent : EventTarget {
  constructor(VoiceAgentOptions options);
  
  readonly attribute VoiceAgentState state;
  readonly attribute boolean isListening;
  readonly attribute boolean isSpeaking;
  
  Promise<undefined> start();
  Promise<undefined> stop();
  Promise<undefined> speak(DOMString text, optional SpeakOptions options = {});
  
  attribute EventHandler onstart;
  attribute EventHandler onstop;
  attribute EventHandler ontranscript;
  attribute EventHandler onresponse;
  attribute EventHandler onaction;
  attribute EventHandler onerror;
};

enum VoiceAgentState { "idle", "listening", "processing", "speaking" };

dictionary VoiceAgentOptions {
  DOMString language = "en-US";
  boolean continuous = true;
  boolean interimResults = true;
  USVString aiProviderUrl = "";
  sequence<VoiceAgentCapability> capabilities = [];
};
</xmp>

### {{VoiceAgent/state}} attribute ### {#state-attribute}

The <dfn attribute for="VoiceAgent">state</dfn> attribute returns the current
state of the voice agent. It MUST return one of the following values:

: "idle"
:: The agent is not actively listening or speaking.
: "listening"
:: The agent is listening for user speech.
: "processing"
:: The agent is processing user input with the AI provider.
: "speaking"
:: The agent is speaking a response.

### {{VoiceAgent/start()}} method ### {#start-method}

The <dfn method for="VoiceAgent">start()</dfn> method, when invoked, MUST run
the following steps:

1. Let |agent| be the context object.
2. If |agent|'s {{VoiceAgent/isListening}} is true, return a promise resolved
   with undefined.
3. Let |promise| be a new promise.
4. Request microphone permission.
5. If permission is denied, reject |promise| with a "NotAllowedError"
   {{DOMException}} and return |promise|.
6. Start speech recognition.
7. Set |agent|'s {{VoiceAgent/state}} to "listening".
8. Set |agent|'s {{VoiceAgent/isListening}} to true.
9. Fire an event named "start" at |agent|.
10. Resolve |promise| with undefined.
11. Return |promise|.

# Security Considerations # {#security}

## Permission Model ## {#permission-model}

The Voice Agent API MUST require explicit user permission before accessing
the microphone or connecting to AI providers.

## Content Security Policy ## {#csp}

AI provider URLs MUST be controlled via Content Security Policy using the
`connect-src` directive.

# Privacy Considerations # {#privacy}

## Data Minimization ## {#data-minimization}

Implementations SHOULD only send the minimum data necessary to AI providers.

## Visual Indicator ## {#visual-indicator}

Implementations MUST provide a clear visual indicator when the microphone is
active.

# Acknowledgments # {#acknowledgments}

The editors would like to thank the following people for their contributions:
- [Contributors]
```

### Build the Specification

```bash
# Build HTML
bikeshed spec index.bs

# Or watch for changes
bikeshed watch index.bs
```

---

## Step 6: Get Browser Vendor Feedback

### Intent to Prototype

Once you have initial specification, file "Intent to Prototype" with browser vendors:

**Chromium:**
1. File a bug on crbug.com
2. Send email to blink-dev@chromium.org

**Mozilla:**
1. File a bug on bugzilla.mozilla.org
2. Post to dev-platform@lists.mozilla.org

**WebKit:**
1. File a bug on bugs.webkit.org
2. Post to webkit-dev@lists.webkit.org

### Template for Intent to Prototype

```
Subject: Intent to Prototype: Voice Agent API

Contact emails: your.email@example.com

Explainer: https://github.com/user/voice-agent/blob/main/explainer.md

Specification: https://user.github.io/voice-agent/

Summary:
The Voice Agent API enables web applications to create conversational AI
experiences by combining speech recognition, natural language processing,
and speech synthesis.

Blink component: Blink>Speech

TAG review: https://github.com/w3ctag/design-reviews/issues/XXX

Risks:
- Interoperability: Low (building on existing Web Speech API)
- Gecko: Positive signals in discussions
- WebKit: No signal yet
- Web developers: Strong interest

Is this feature supported on all six Blink platforms?
Yes (desktop and mobile)

Debuggability:
DevTools will show Voice Agent connections and events.

Will this feature be supported on the Android WebView?
Yes

Is this feature fully tested by web-platform-tests?
Tests will be added during implementation.
```

---

## Step 7: Move to Working Group

Once there's enough interest and implementation experience, the proposal can move to a W3C Working Group.

### Requirements for Transition

1. **Multiple implementations**: At least 2 browser vendors implementing
2. **Stable specification**: No major open issues
3. **Test suite**: Web Platform Tests coverage
4. **Positive reviews**: TAG review completed
5. **Working Group interest**: WG willing to adopt

### Working Group Charter

The specification would likely be adopted by:
- **Web Real-Time Communications WG** (WebRTC, Media)
- **Web Applications WG** (APIs)
- **Or a new Voice/Conversational AI WG**

---

## Resources

### W3C Resources
- [W3C Process](https://www.w3.org/2021/Process-20211102/)
- [WICG](https://www.w3.org/community/wicg/)
- [TAG Reviews](https://github.com/w3ctag/design-reviews)
- [Web Platform Tests](https://web-platform-tests.org/)

### Tools
- [Bikeshed](https://speced.github.io/bikeshed/)
- [ReSpec](https://respec.org/docs/)
- [Echidna](https://github.com/w3c/echidna) (publishing)

### Examples
- [Web Speech API](https://github.com/AurelienLourot/web-speech-api)
- [WebXR](https://github.com/immersive-web/webxr)
- [WebGPU](https://github.com/gpuweb/gpuweb)

---

## Timeline Estimate

| Phase | Duration | Activities |
|-------|----------|------------|
| Explainer | 1-2 months | Write explainer, gather feedback |
| WICG Incubation | 6-12 months | Refine proposal, get implementations |
| Working Draft | 12-24 months | Formal spec, test suite |
| Candidate Rec | 6-12 months | Implementation experience |
| Recommendation | 3-6 months | Final review, publication |

**Total: 2-4+ years** for a full W3C Recommendation
