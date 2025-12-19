# TTS Synthesis API

## Overview

This document defines the Text-to-Speech Synthesis API for the voice agent. The API provides a unified interface across multiple TTS providers with support for streaming synthesis, voice selection, and SSML.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       TTS Synthesis API                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    TTSEngine                             │    │
│  │                                                          │    │
│  │  synthesize(text) ─────────► AudioStream                 │    │
│  │  synthesizeSSML(ssml) ─────► AudioStream                 │    │
│  │  getVoices() ─────────────► Voice[]                      │    │
│  │                                                          │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   Edge TTS  │     │ ElevenLabs  │     │ Browser API │       │
│  │   Provider  │     │   Provider  │     │   Provider  │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Interface

### TypeScript Definitions

```typescript
// types.ts

/**
 * Voice definition
 */
export interface Voice {
  id: string;
  name: string;
  language: string;        // BCP-47 language tag
  languageCodes: string[]; // All supported languages
  gender: 'male' | 'female' | 'neutral';
  provider: string;
  styles?: string[];       // Supported speaking styles
  isNeural?: boolean;      // Whether it's a neural voice
  previewUrl?: string;     // URL to preview audio
}

/**
 * Synthesis options
 */
export interface SynthesisOptions {
  voice?: string;          // Voice ID or name
  language?: string;       // Target language
  rate?: number;           // Speaking rate (0.25-4.0, default: 1.0)
  pitch?: number;          // Voice pitch (-20 to 20 semitones, default: 0)
  volume?: number;         // Volume (0-100, default: 100)
  style?: string;          // Speaking style (e.g., 'cheerful', 'sad')
  outputFormat?: AudioFormat;
}

/**
 * Audio output formats
 */
export type AudioFormat = 
  | 'mp3'
  | 'opus'
  | 'ogg_opus'
  | 'webm_opus'
  | 'wav'
  | 'pcm_16000'
  | 'pcm_24000'
  | 'pcm_44100';

/**
 * Synthesis event types
 */
export interface SynthesisEvents {
  start: { text: string; voice: Voice };
  audio: { chunk: ArrayBuffer; timestamp: number };
  word: { word: string; startTime: number; endTime: number };
  sentence: { text: string; startTime: number; endTime: number };
  viseme: { visemeId: number; timestamp: number };
  end: { duration: number };
  error: { error: Error };
}

/**
 * TTS Provider interface
 */
export interface TTSProvider {
  name: string;
  
  /**
   * Initialize the provider
   */
  initialize(): Promise<void>;
  
  /**
   * Get available voices
   */
  getVoices(language?: string): Promise<Voice[]>;
  
  /**
   * Synthesize text to audio buffer
   */
  synthesize(text: string, options?: SynthesisOptions): Promise<ArrayBuffer>;
  
  /**
   * Synthesize text with streaming
   */
  synthesizeStream(
    text: string, 
    options?: SynthesisOptions
  ): AsyncGenerator<ArrayBuffer>;
  
  /**
   * Synthesize SSML
   */
  synthesizeSSML?(ssml: string, options?: SynthesisOptions): Promise<ArrayBuffer>;
  
  /**
   * Synthesize SSML with streaming
   */
  synthesizeSSMLStream?(
    ssml: string, 
    options?: SynthesisOptions
  ): AsyncGenerator<ArrayBuffer>;
  
  /**
   * Clean up resources
   */
  destroy(): Promise<void>;
}
```

---

## Provider Implementations

### Edge TTS Provider

Free, high-quality neural TTS using Microsoft's Edge service.

```typescript
// providers/edge-tts.ts

import { Communicate } from 'edge-tts';

export class EdgeTTSProvider implements TTSProvider {
  name = 'edge-tts';
  private voices: Voice[] = [];
  
  async initialize(): Promise<void> {
    // Fetch available voices
    const edgeVoices = await this.fetchVoices();
    this.voices = edgeVoices.map(v => ({
      id: v.ShortName,
      name: v.FriendlyName,
      language: v.Locale,
      languageCodes: [v.Locale],
      gender: v.Gender.toLowerCase() as 'male' | 'female',
      provider: 'edge-tts',
      isNeural: true
    }));
  }
  
  async getVoices(language?: string): Promise<Voice[]> {
    if (!language) return this.voices;
    return this.voices.filter(v => 
      v.languageCodes.some(l => l.startsWith(language))
    );
  }
  
  async synthesize(text: string, options?: SynthesisOptions): Promise<ArrayBuffer> {
    const chunks: ArrayBuffer[] = [];
    for await (const chunk of this.synthesizeStream(text, options)) {
      chunks.push(chunk);
    }
    return this.concatenateArrayBuffers(chunks);
  }
  
  async *synthesizeStream(
    text: string,
    options?: SynthesisOptions
  ): AsyncGenerator<ArrayBuffer> {
    const voice = options?.voice || 'en-US-AriaNeural';
    const rate = this.formatRate(options?.rate);
    const pitch = this.formatPitch(options?.pitch);
    
    const communicate = new Communicate(text, voice, rate, pitch);
    
    for await (const chunk of communicate.stream()) {
      if (chunk.type === 'audio') {
        yield chunk.data;
      }
    }
  }
  
  async destroy(): Promise<void> {
    // Cleanup
  }
  
  private formatRate(rate?: number): string {
    if (!rate) return '+0%';
    const percentage = Math.round((rate - 1) * 100);
    return percentage >= 0 ? `+${percentage}%` : `${percentage}%`;
  }
  
  private formatPitch(pitch?: number): string {
    if (!pitch) return '+0Hz';
    return pitch >= 0 ? `+${pitch}Hz` : `${pitch}Hz`;
  }
  
  private concatenateArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
    const totalLength = buffers.reduce((sum, b) => sum + b.byteLength, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buffer of buffers) {
      result.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    }
    return result.buffer;
  }
}
```

### ElevenLabs Provider

High-quality AI voice synthesis with emotion.

```typescript
// providers/elevenlabs.ts

export class ElevenLabsTTSProvider implements TTSProvider {
  name = 'elevenlabs';
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async initialize(): Promise<void> {
    // Verify API key
    const response = await fetch(`${this.baseUrl}/user`, {
      headers: { 'xi-api-key': this.apiKey }
    });
    if (!response.ok) {
      throw new Error('Invalid ElevenLabs API key');
    }
  }
  
  async getVoices(language?: string): Promise<Voice[]> {
    const response = await fetch(`${this.baseUrl}/voices`, {
      headers: { 'xi-api-key': this.apiKey }
    });
    const data = await response.json();
    
    return data.voices.map((v: any) => ({
      id: v.voice_id,
      name: v.name,
      language: 'en-US', // ElevenLabs is primarily English
      languageCodes: ['en-US', 'en-GB'],
      gender: v.labels?.gender || 'neutral',
      provider: 'elevenlabs',
      styles: v.labels?.use_case ? [v.labels.use_case] : [],
      isNeural: true,
      previewUrl: v.preview_url
    }));
  }
  
  async synthesize(text: string, options?: SynthesisOptions): Promise<ArrayBuffer> {
    const voiceId = options?.voice || 'EXAVITQu4vr4xnSDxMaL'; // Default voice
    
    const response = await fetch(
      `${this.baseUrl}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      }
    );
    
    return await response.arrayBuffer();
  }
  
  async *synthesizeStream(
    text: string,
    options?: SynthesisOptions
  ): AsyncGenerator<ArrayBuffer> {
    const voiceId = options?.voice || 'EXAVITQu4vr4xnSDxMaL';
    
    const response = await fetch(
      `${this.baseUrl}/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      }
    );
    
    const reader = response.body!.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value.buffer;
    }
  }
  
  async destroy(): Promise<void> {
    // Cleanup
  }
}
```

### Browser Web Speech API Provider

Native browser TTS using the Web Speech API.

```typescript
// providers/browser-tts.ts

export class BrowserTTSProvider implements TTSProvider {
  name = 'browser';
  private synth: SpeechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];
  
  constructor() {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      throw new Error('Web Speech API not supported');
    }
    this.synth = window.speechSynthesis;
  }
  
  async initialize(): Promise<void> {
    // Wait for voices to load
    return new Promise((resolve) => {
      const checkVoices = () => {
        this.voices = this.synth.getVoices();
        if (this.voices.length > 0) {
          resolve();
        } else {
          setTimeout(checkVoices, 100);
        }
      };
      
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => {
          this.voices = this.synth.getVoices();
          resolve();
        };
      }
      
      checkVoices();
    });
  }
  
  async getVoices(language?: string): Promise<Voice[]> {
    let filtered = this.voices;
    if (language) {
      filtered = this.voices.filter(v => v.lang.startsWith(language));
    }
    
    return filtered.map(v => ({
      id: v.voiceURI,
      name: v.name,
      language: v.lang,
      languageCodes: [v.lang],
      gender: this.inferGender(v.name),
      provider: 'browser',
      isNeural: v.name.includes('Neural') || v.name.includes('Premium')
    }));
  }
  
  async synthesize(text: string, options?: SynthesisOptions): Promise<ArrayBuffer> {
    // Browser API doesn't provide raw audio, use AudioContext recording
    return new Promise((resolve, reject) => {
      const utterance = this.createUtterance(text, options);
      
      // Use MediaRecorder to capture audio
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      const mediaRecorder = new MediaRecorder(destination.stream);
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        resolve(await blob.arrayBuffer());
      };
      
      utterance.onstart = () => mediaRecorder.start();
      utterance.onend = () => mediaRecorder.stop();
      utterance.onerror = (e) => reject(new Error(e.error));
      
      this.synth.speak(utterance);
    });
  }
  
  async *synthesizeStream(
    text: string,
    options?: SynthesisOptions
  ): AsyncGenerator<ArrayBuffer> {
    // Browser API doesn't support streaming, synthesize full audio
    const audio = await this.synthesize(text, options);
    yield audio;
  }
  
  async destroy(): Promise<void> {
    this.synth.cancel();
  }
  
  private createUtterance(
    text: string, 
    options?: SynthesisOptions
  ): SpeechSynthesisUtterance {
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (options?.voice) {
      const voice = this.voices.find(v => 
        v.voiceURI === options.voice || v.name === options.voice
      );
      if (voice) utterance.voice = voice;
    }
    
    if (options?.language) utterance.lang = options.language;
    if (options?.rate) utterance.rate = options.rate;
    if (options?.pitch) utterance.pitch = 1 + (options.pitch / 20);
    if (options?.volume) utterance.volume = options.volume / 100;
    
    return utterance;
  }
  
  private inferGender(name: string): 'male' | 'female' | 'neutral' {
    const lowerName = name.toLowerCase();
    const femaleNames = ['female', 'woman', 'samantha', 'victoria', 'karen', 'alice'];
    const maleNames = ['male', 'man', 'daniel', 'alex', 'david', 'james'];
    
    if (femaleNames.some(n => lowerName.includes(n))) return 'female';
    if (maleNames.some(n => lowerName.includes(n))) return 'male';
    return 'neutral';
  }
}
```

### Local Piper TTS Provider

Offline TTS using Piper for privacy-focused applications.

```typescript
// providers/piper-tts.ts

export class PiperTTSProvider implements TTSProvider {
  name = 'piper';
  private wasmModule: any;
  private modelPath: string;
  
  constructor(modelPath: string) {
    this.modelPath = modelPath;
  }
  
  async initialize(): Promise<void> {
    // Load Piper WASM module
    this.wasmModule = await import('piper-wasm');
    await this.wasmModule.initialize(this.modelPath);
  }
  
  async getVoices(language?: string): Promise<Voice[]> {
    // Piper uses single voice per model
    return [{
      id: 'piper-default',
      name: 'Piper Local Voice',
      language: 'en-US',
      languageCodes: ['en-US'],
      gender: 'neutral',
      provider: 'piper',
      isNeural: true
    }];
  }
  
  async synthesize(text: string, options?: SynthesisOptions): Promise<ArrayBuffer> {
    const samples = await this.wasmModule.synthesize(text, {
      speakerId: 0,
      lengthScale: options?.rate ? 1 / options.rate : 1,
      noiseScale: 0.667,
      noiseW: 0.8
    });
    
    // Convert float samples to PCM
    return this.floatToPCM(samples);
  }
  
  async *synthesizeStream(
    text: string,
    options?: SynthesisOptions
  ): AsyncGenerator<ArrayBuffer> {
    // Piper doesn't support streaming, synthesize full audio
    const audio = await this.synthesize(text, options);
    yield audio;
  }
  
  async destroy(): Promise<void> {
    if (this.wasmModule) {
      this.wasmModule.dispose();
    }
  }
  
  private floatToPCM(samples: Float32Array): ArrayBuffer {
    const pcm = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcm.buffer;
  }
}
```

---

## SSML Support

### Supported SSML Elements

```xml
<!-- Basic SSML structure -->
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis">
  
  <!-- Voice selection -->
  <voice name="en-US-AriaNeural">
    Hello, this is Aria speaking.
  </voice>
  
  <!-- Prosody control -->
  <prosody rate="slow" pitch="+2st" volume="loud">
    Speaking slowly with higher pitch.
  </prosody>
  
  <!-- Emphasis -->
  <emphasis level="strong">important</emphasis>
  
  <!-- Break/pause -->
  <break time="500ms"/>
  <break strength="medium"/>
  
  <!-- Say-as (pronunciation) -->
  <say-as interpret-as="cardinal">12345</say-as>
  <say-as interpret-as="date" format="mdy">12/25/2024</say-as>
  <say-as interpret-as="telephone">+1-555-123-4567</say-as>
  <say-as interpret-as="currency">$100.50</say-as>
  
  <!-- Phoneme (IPA pronunciation) -->
  <phoneme alphabet="ipa" ph="ˈpɛkən">pecan</phoneme>
  
  <!-- Substitution -->
  <sub alias="World Wide Web">WWW</sub>
  
  <!-- Audio insertion -->
  <audio src="https://example.com/sound.mp3">
    Fallback text if audio fails
  </audio>
  
</speak>
```

### SSML Builder

```typescript
// ssml-builder.ts

class SSMLBuilder {
  private content: string[] = [];
  
  text(text: string): this {
    this.content.push(this.escape(text));
    return this;
  }
  
  voice(name: string, content: string | ((builder: SSMLBuilder) => void)): this {
    if (typeof content === 'function') {
      const inner = new SSMLBuilder();
      content(inner);
      this.content.push(`<voice name="${name}">${inner.build(false)}</voice>`);
    } else {
      this.content.push(`<voice name="${name}">${this.escape(content)}</voice>`);
    }
    return this;
  }
  
  prosody(options: ProsodyOptions, content: string): this {
    const attrs = Object.entries(options)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    this.content.push(`<prosody ${attrs}>${this.escape(content)}</prosody>`);
    return this;
  }
  
  emphasis(level: 'strong' | 'moderate' | 'reduced', text: string): this {
    this.content.push(`<emphasis level="${level}">${this.escape(text)}</emphasis>`);
    return this;
  }
  
  break(options: { time?: string; strength?: string }): this {
    const attrs = Object.entries(options)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    this.content.push(`<break ${attrs}/>`);
    return this;
  }
  
  sayAs(interpretAs: string, text: string, format?: string): this {
    const formatAttr = format ? ` format="${format}"` : '';
    this.content.push(
      `<say-as interpret-as="${interpretAs}"${formatAttr}>${this.escape(text)}</say-as>`
    );
    return this;
  }
  
  phoneme(text: string, ipa: string): this {
    this.content.push(
      `<phoneme alphabet="ipa" ph="${ipa}">${this.escape(text)}</phoneme>`
    );
    return this;
  }
  
  build(wrapInSpeak = true): string {
    const inner = this.content.join('');
    if (wrapInSpeak) {
      return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis">${inner}</speak>`;
    }
    return inner;
  }
  
  private escape(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

interface ProsodyOptions {
  rate?: 'x-slow' | 'slow' | 'medium' | 'fast' | 'x-fast' | string;
  pitch?: 'x-low' | 'low' | 'medium' | 'high' | 'x-high' | string;
  volume?: 'silent' | 'x-soft' | 'soft' | 'medium' | 'loud' | 'x-loud' | string;
}

// Usage
const ssml = new SSMLBuilder()
  .text('Hello! ')
  .prosody({ rate: 'slow' }, 'This is spoken slowly.')
  .break({ time: '500ms' })
  .emphasis('strong', 'Important')
  .text(' information about ')
  .sayAs('currency', '$1,000.50')
  .build();
```

---

## Audio Playback

### Web Audio API Player

```typescript
// audio-player.ts

export class AudioPlayer {
  private audioContext: AudioContext;
  private gainNode: GainNode;
  private queue: ArrayBuffer[] = [];
  private isPlaying = false;
  private currentSource: AudioBufferSourceNode | null = null;
  
  constructor() {
    this.audioContext = new AudioContext();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
  }
  
  setVolume(volume: number): void {
    this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
  }
  
  async play(audio: ArrayBuffer): Promise<void> {
    const audioBuffer = await this.audioContext.decodeAudioData(audio.slice(0));
    
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);
    
    return new Promise((resolve) => {
      source.onended = () => resolve();
      source.start();
      this.currentSource = source;
    });
  }
  
  async playStream(stream: AsyncGenerator<ArrayBuffer>): Promise<void> {
    this.isPlaying = true;
    
    for await (const chunk of stream) {
      if (!this.isPlaying) break;
      
      this.queue.push(chunk);
      await this.playNextInQueue();
    }
    
    // Play remaining queue
    while (this.queue.length > 0 && this.isPlaying) {
      await this.playNextInQueue();
    }
    
    this.isPlaying = false;
  }
  
  stop(): void {
    this.isPlaying = false;
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
    this.queue = [];
  }
  
  pause(): void {
    this.audioContext.suspend();
  }
  
  resume(): void {
    this.audioContext.resume();
  }
  
  private async playNextInQueue(): Promise<void> {
    const chunk = this.queue.shift();
    if (!chunk) return;
    
    try {
      await this.play(chunk);
    } catch (error) {
      console.error('Error playing audio chunk:', error);
    }
  }
}
```

---

## Usage Examples

### Basic Usage

```typescript
import { TTSEngine } from '@sahayak/tts';

const tts = new TTSEngine({
  provider: 'edge-tts',
  defaultVoice: 'en-US-AriaNeural',
  defaultRate: 1.0
});

await tts.initialize();

// Get available voices
const voices = await tts.getVoices('en');
console.log('Available voices:', voices);

// Synthesize text
const audio = await tts.synthesize('Hello, world!');
await tts.play(audio);

// Stream synthesis
const player = new AudioPlayer();
await player.playStream(
  tts.synthesizeStream('This is a longer text that will be streamed.')
);
```

### With SSML

```typescript
const ssml = new SSMLBuilder()
  .text('Your account balance is ')
  .sayAs('currency', '$1,234.56')
  .break({ time: '300ms' })
  .prosody({ rate: 'slow' }, 'Would you like to make a transfer?')
  .build();

const audio = await tts.synthesizeSSML(ssml);
await tts.play(audio);
```

### Provider Selection

```typescript
// Use ElevenLabs for higher quality
const elevenlabs = new TTSEngine({
  provider: 'elevenlabs',
  apiKey: process.env.ELEVENLABS_API_KEY,
  defaultVoice: 'Rachel'
});

// Use local Piper for privacy
const piper = new TTSEngine({
  provider: 'piper',
  modelPath: '/models/en_US-lessac-medium.onnx'
});

// Fallback chain
const tts = new TTSEngine({
  provider: 'elevenlabs',
  apiKey: process.env.ELEVENLABS_API_KEY,
  fallback: {
    provider: 'edge-tts'
  }
});
```
