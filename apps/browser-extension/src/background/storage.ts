// Storage Manager for Chrome Extension

export interface Settings {
  sttProvider: 'web-speech' | 'whisper';
  llmProvider: 'groq' | 'openai' | 'anthropic' | 'local';
  llmApiKey: string;
  llmModel: string;
  ttsProvider: string;
  voice: string;
  language: string;
  wakeWord: string;
  enableWakeWord: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  sttProvider: 'web-speech',
  llmProvider: 'groq',
  llmApiKey: '',
  llmModel: 'llama-3.3-70b-versatile',
  ttsProvider: 'browser',
  voice: 'en-US',
  language: 'en-US',
  wakeWord: 'hey sahayak',
  enableWakeWord: false,
};

export class StorageManager {
  async get<K extends keyof Settings>(key: K): Promise<Settings[K]> {
    const result = await chrome.storage.sync.get(key);
    return result[key] ?? DEFAULT_SETTINGS[key];
  }

  async getAll(): Promise<Settings> {
    const result = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
    return { ...DEFAULT_SETTINGS, ...result } as Settings;
  }

  async getSettings(): Promise<Settings> {
    return this.getAll();
  }

  async set(settings: Partial<Settings>): Promise<void> {
    await chrome.storage.sync.set(settings);
  }

  async updateSettings(settings: Partial<Settings>): Promise<void> {
    await this.set(settings);
  }

  async setDefaults(defaults: Partial<Settings>): Promise<void> {
    const existing = await chrome.storage.sync.get(Object.keys(defaults));
    const toSet: Partial<Settings> = {};
    
    for (const [key, value] of Object.entries(defaults)) {
      if (existing[key] === undefined) {
        (toSet as Record<string, unknown>)[key] = value;
      }
    }
    
    if (Object.keys(toSet).length > 0) {
      await chrome.storage.sync.set(toSet);
    }
  }

  async clear(): Promise<void> {
    await chrome.storage.sync.clear();
  }
}
