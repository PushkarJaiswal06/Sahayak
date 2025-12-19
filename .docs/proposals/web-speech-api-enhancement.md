# W3C Web Speech API Enhancement Proposal

## Proposal: Streaming Speech Recognition API Extension

**Status**: Draft  
**Author**: Sahayak Team  
**Target**: W3C Web Speech Community Group  
**Specification**: https://wicg.github.io/speech-api/

---

## Abstract

This proposal extends the existing Web Speech API to support real-time streaming speech recognition with enhanced capabilities for building voice-first applications. The current Web Speech API lacks support for streaming audio to custom ASR providers, interim result handling, and integration with modern AI assistants.

---

## 1. Problem Statement

### Current Limitations

1. **No Custom Provider Support**: The current API only supports browser-native speech recognition
2. **Limited Streaming**: No standard way to stream audio to external services
3. **No Interim Results API**: Interim results are implementation-dependent
4. **Missing Confidence Scores**: No standardized confidence metadata
5. **No Audio Access**: Cannot access raw audio data for custom processing
6. **Limited Language Support**: Dependent on browser vendor implementation

### Use Cases Not Supported

- Voice assistants with custom AI backends
- Real-time transcription services
- Multi-language voice applications
- Voice-controlled web applications with complex commands
- Accessibility tools with enhanced voice control

---

## 2. Proposed Solution

### 2.1 Extended SpeechRecognition Interface

```webidl
[Exposed=Window]
partial interface SpeechRecognition {
  // New: Stream mode for custom providers
  attribute DOMString providerUrl;
  attribute SpeechRecognitionProvider provider;
  
  // New: Audio access
  attribute boolean exposeAudio;
  attribute AudioWorkletNode? audioProcessor;
  
  // New: Enhanced results
  attribute boolean includeConfidence;
  attribute boolean includeAlternatives;
  attribute boolean includeTimestamps;
  
  // New: Events
  attribute EventHandler onaudiodata;
  attribute EventHandler oninterimresult;
  attribute EventHandler onfinalresult;
  attribute EventHandler onproviderconnect;
  attribute EventHandler onproviderdisconnect;
};

// New interface for custom providers
[Exposed=Window]
interface SpeechRecognitionProvider {
  readonly attribute DOMString name;
  readonly attribute DOMString[] supportedLanguages;
  readonly attribute boolean supportsStreaming;
  
  Promise<void> connect(DOMString url, optional SpeechRecognitionProviderConfig config);
  void sendAudio(ArrayBuffer audioData);
  Promise<void> disconnect();
};

dictionary SpeechRecognitionProviderConfig {
  DOMString apiKey;
  DOMString model;
  DOMString language;
  boolean interimResults = true;
  long sampleRate = 16000;
  DOMString encoding = "linear16";
};
```

### 2.2 Enhanced Results Interface

```webidl
[Exposed=Window]
partial interface SpeechRecognitionResult {
  // New: Detailed metadata
  readonly attribute float confidence;
  readonly attribute DOMString language;
  readonly attribute double startTime;
  readonly attribute double endTime;
  readonly attribute boolean isFinal;
  
  // New: Word-level detail
  readonly attribute FrozenArray<SpeechRecognitionWord> words;
};

[Exposed=Window]
interface SpeechRecognitionWord {
  readonly attribute DOMString word;
  readonly attribute float confidence;
  readonly attribute double startTime;
  readonly attribute double endTime;
};
```

### 2.3 Audio Data Event

```webidl
[Exposed=Window]
interface SpeechRecognitionAudioEvent : Event {
  readonly attribute ArrayBuffer audioData;
  readonly attribute double timestamp;
  readonly attribute long sampleRate;
  readonly attribute long channelCount;
};
```

---

## 3. API Examples

### 3.1 Basic Streaming to Custom Provider

```javascript
const recognition = new SpeechRecognition();

// Configure custom provider
recognition.providerUrl = 'wss://api.deepgram.com/v1/listen';
recognition.provider.connect(recognition.providerUrl, {
  apiKey: 'your-api-key',
  model: 'nova-2',
  language: 'en-US',
  interimResults: true
});

// Enable audio exposure
recognition.exposeAudio = true;

// Handle interim results
recognition.oninterimresult = (event) => {
  console.log('Interim:', event.results[0][0].transcript);
};

// Handle final results
recognition.onfinalresult = (event) => {
  const result = event.results[0][0];
  console.log('Final:', result.transcript);
  console.log('Confidence:', result.confidence);
  console.log('Words:', result.words);
};

// Handle raw audio (for visualization, etc.)
recognition.onaudiodata = (event) => {
  visualizeAudio(event.audioData);
};

recognition.start();
```

### 3.2 Voice Agent Integration

```javascript
class VoiceAgent {
  constructor() {
    this.recognition = new SpeechRecognition();
    this.setupRecognition();
  }
  
  setupRecognition() {
    // Use browser-native or custom provider
    if (this.config.customProvider) {
      this.recognition.provider.connect(this.config.providerUrl, {
        apiKey: this.config.apiKey,
        model: 'nova-2',
        interimResults: true
      });
    }
    
    this.recognition.includeConfidence = true;
    this.recognition.includeTimestamps = true;
    
    this.recognition.onfinalresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      const response = await this.processWithLLM(transcript);
      await this.speak(response);
    };
  }
  
  async processWithLLM(text) {
    // Send to AI backend
    const response = await fetch('/api/agent', {
      method: 'POST',
      body: JSON.stringify({ text })
    });
    return response.json();
  }
}
```

---

## 4. Security Considerations

### 4.1 Permission Model

```javascript
// New permission for custom providers
const permission = await navigator.permissions.query({
  name: 'speech-recognition',
  custom_provider: true
});

if (permission.state === 'prompt') {
  // Browser shows permission dialog mentioning:
  // - Microphone access
  // - Data sent to external service
  // - Provider URL displayed
}
```

### 4.2 Content Security Policy

```http
Content-Security-Policy: connect-src 'self' wss://api.deepgram.com;
```

### 4.3 Data Protection

- Audio data MUST be transmitted over secure connections (WSS/HTTPS)
- Browser SHOULD warn users when audio is sent to third-party providers
- Providers MUST be explicitly whitelisted by the page

---

## 5. Privacy Considerations

1. **Informed Consent**: Users must be clearly informed when audio is sent to external services
2. **Data Minimization**: API should support options to limit data collection
3. **Local Processing Option**: Browser-native recognition should remain as default
4. **Audit Trail**: Browsers should log which providers received audio data

---

## 6. Backward Compatibility

The proposal is fully backward compatible:

- Existing `SpeechRecognition` usage continues to work
- New features are opt-in via new properties
- Default behavior remains browser-native recognition

---

## 7. Implementation Considerations

### For Browser Vendors

1. **AudioWorklet Integration**: Use AudioWorklet for efficient audio processing
2. **Provider Sandbox**: Custom providers should run in isolated contexts
3. **Rate Limiting**: Implement rate limiting for audio streaming
4. **Fallback**: Provide fallback to native recognition if provider fails

### For Provider Implementers

1. **WebSocket Protocol**: Standardize WebSocket message format
2. **Error Handling**: Define standard error codes and messages
3. **Authentication**: Support multiple auth methods (API key, OAuth)

---

## 8. Related Specifications

- [Web Speech API](https://wicg.github.io/speech-api/)
- [MediaStream Recording](https://www.w3.org/TR/mediastream-recording/)
- [Web Audio API](https://www.w3.org/TR/webaudio/)
- [Permissions API](https://www.w3.org/TR/permissions/)

---

## 9. Acknowledgments

- W3C Web Speech Community Group
- Browser vendors (Google, Mozilla, Apple, Microsoft)
- Speech recognition providers (Deepgram, Google, Amazon, Microsoft)
- Voice assistant developers

---

## 10. Appendix: WebSocket Protocol

### Message Format

```typescript
// Client → Server
interface AudioMessage {
  type: 'audio';
  data: ArrayBuffer;  // Raw PCM audio
  timestamp: number;
}

interface ConfigMessage {
  type: 'config';
  language: string;
  model?: string;
  interimResults: boolean;
}

// Server → Client
interface TranscriptMessage {
  type: 'transcript';
  text: string;
  confidence: number;
  isFinal: boolean;
  words?: Word[];
  startTime?: number;
  endTime?: number;
}

interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}
```

---

## 11. Next Steps

1. Submit to W3C Web Speech Community Group
2. Gather feedback from browser vendors
3. Create polyfill implementation
4. Build reference implementations
5. Iterate based on feedback
6. Submit for formal standardization

---

## References

1. [W3C Web Speech API](https://wicg.github.io/speech-api/)
2. [Deepgram API Documentation](https://developers.deepgram.com/)
3. [Google Cloud Speech-to-Text](https://cloud.google.com/speech-to-text)
4. [Mozilla DeepSpeech](https://github.com/mozilla/DeepSpeech)
