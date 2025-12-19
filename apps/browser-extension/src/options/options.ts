/**
 * Sahayak Voice Agent - Options Page Script
 * 
 * Handles settings management for the extension
 */

import { StorageManager, type Settings } from '../background/storage';

const storage = new StorageManager();

// DOM Elements
const elements = {
  // LLM Settings
  llmProvider: document.getElementById('llm-provider') as HTMLSelectElement,
  llmApiKey: document.getElementById('llm-api-key') as HTMLInputElement,
  llmModel: document.getElementById('llm-model') as HTMLSelectElement,
  localUrl: document.getElementById('local-url') as HTMLInputElement,
  localUrlGroup: document.getElementById('local-url-group') as HTMLDivElement,

  // Voice Settings
  sttProvider: document.getElementById('stt-provider') as HTMLSelectElement,
  language: document.getElementById('language') as HTMLSelectElement,
  voice: document.getElementById('voice') as HTMLSelectElement,
  testVoice: document.getElementById('test-voice') as HTMLButtonElement,
  speechRate: document.getElementById('speech-rate') as HTMLInputElement,
  speechRateValue: document.querySelector('.range-value') as HTMLSpanElement,

  // Wake Word
  wakeWordEnabled: document.getElementById('wake-word-enabled') as HTMLInputElement,
  wakeWord: document.getElementById('wake-word') as HTMLInputElement,
  wakeWordGroup: document.getElementById('wake-word-group') as HTMLDivElement,

  // Privacy
  sendPageContext: document.getElementById('send-page-context') as HTMLInputElement,
  saveHistory: document.getElementById('save-history') as HTMLInputElement,
  clearData: document.getElementById('clear-data') as HTMLButtonElement,

  // Buttons
  saveBtn: document.getElementById('save-btn') as HTMLButtonElement,
  resetBtn: document.getElementById('reset-btn') as HTMLButtonElement,

  // Toast
  toast: document.getElementById('toast') as HTMLDivElement,
  toastMessage: document.querySelector('.toast-message') as HTMLSpanElement,
};

/**
 * Initialize options page
 */
async function init(): Promise<void> {
  // Load current settings
  const settings = await storage.getSettings();
  populateForm(settings);

  // Populate voice options
  populateVoices();

  // Add event listeners
  setupEventListeners();
}

/**
 * Populate form with current settings
 */
function populateForm(settings: Settings): void {
  elements.llmProvider.value = settings.llmProvider;
  elements.llmApiKey.value = settings.llmApiKey;
  elements.llmModel.value = settings.llmModel;
  elements.sttProvider.value = settings.sttProvider;
  elements.language.value = settings.language;
  elements.wakeWord.value = settings.wakeWord;

  // Parse speech rate from voice setting if stored
  elements.speechRate.value = '1';
  elements.speechRateValue.textContent = '1x';

  // Show/hide local URL based on provider
  toggleLocalUrlVisibility();
}

/**
 * Populate voice options from browser
 */
function populateVoices(): void {
  const loadVoices = () => {
    const voices = speechSynthesis.getVoices();
    elements.voice.innerHTML = '';

    if (voices.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No voices available';
      elements.voice.appendChild(option);
      return;
    }

    // Group voices by language
    const voicesByLang: Record<string, SpeechSynthesisVoice[]> = {};
    voices.forEach((voice) => {
      const lang = voice.lang.split('-')[0];
      if (!voicesByLang[lang]) {
        voicesByLang[lang] = [];
      }
      voicesByLang[lang].push(voice);
    });

    // Create optgroups
    Object.entries(voicesByLang).forEach(([lang, langVoices]) => {
      const group = document.createElement('optgroup');
      group.label = getLanguageName(lang);

      langVoices.forEach((voice) => {
        const option = document.createElement('option');
        option.value = voice.name;
        option.textContent = `${voice.name}${voice.localService ? ' (Local)' : ''}`;
        group.appendChild(option);
      });

      elements.voice.appendChild(group);
    });
  };

  // Voices might load async
  if (speechSynthesis.getVoices().length > 0) {
    loadVoices();
  } else {
    speechSynthesis.onvoiceschanged = loadVoices;
  }
}

/**
 * Get human-readable language name
 */
function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    en: 'English',
    hi: 'Hindi',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    ja: 'Japanese',
    ko: 'Korean',
    zh: 'Chinese',
    ar: 'Arabic',
    pt: 'Portuguese',
    ru: 'Russian',
    it: 'Italian',
  };
  return names[code] || code.toUpperCase();
}

/**
 * Setup event listeners
 */
function setupEventListeners(): void {
  // Provider change - show/hide local URL
  elements.llmProvider.addEventListener('change', () => {
    toggleLocalUrlVisibility();
    updateModelOptions();
  });

  // Wake word enable/disable
  elements.wakeWordEnabled.addEventListener('change', () => {
    elements.wakeWordGroup.style.display = elements.wakeWordEnabled.checked
      ? 'block'
      : 'none';
  });

  // Speech rate change
  elements.speechRate.addEventListener('input', () => {
    elements.speechRateValue.textContent = `${elements.speechRate.value}x`;
  });

  // Test voice
  elements.testVoice.addEventListener('click', testVoice);

  // API key visibility toggle
  document.querySelectorAll('.toggle-visibility').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = (e.currentTarget as HTMLButtonElement).dataset.target;
      if (target) {
        const input = document.getElementById(target) as HTMLInputElement;
        input.type = input.type === 'password' ? 'text' : 'password';
        (e.currentTarget as HTMLButtonElement).textContent =
          input.type === 'password' ? '👁' : '🙈';
      }
    });
  });

  // Clear data
  elements.clearData.addEventListener('click', clearAllData);

  // Save settings
  elements.saveBtn.addEventListener('click', saveSettings);

  // Reset to defaults
  elements.resetBtn.addEventListener('click', resetToDefaults);

  // Change shortcuts link
  const shortcutsLink = document.getElementById('change-shortcuts');
  if (shortcutsLink) {
    shortcutsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
  }
}

/**
 * Toggle local URL visibility based on provider
 */
function toggleLocalUrlVisibility(): void {
  const isLocal = elements.llmProvider.value === 'local';
  elements.localUrlGroup.style.display = isLocal ? 'block' : 'none';
}

/**
 * Update model options based on provider
 */
function updateModelOptions(): void {
  const provider = elements.llmProvider.value;
  const optgroups = elements.llmModel.querySelectorAll('optgroup');

  optgroups.forEach((group) => {
    const groupProvider = group.label.toLowerCase();
    const options = group.querySelectorAll('option');

    if (
      groupProvider === provider ||
      (provider === 'local' && groupProvider === 'groq')
    ) {
      options.forEach((opt) => {
        (opt as HTMLOptionElement).disabled = false;
      });
      // Select first option in this group
      if (options.length > 0) {
        elements.llmModel.value = (options[0] as HTMLOptionElement).value;
      }
    } else {
      options.forEach((opt) => {
        (opt as HTMLOptionElement).disabled = true;
      });
    }
  });
}

/**
 * Test voice synthesis
 */
function testVoice(): void {
  const utterance = new SpeechSynthesisUtterance(
    "Hello! I'm your voice assistant. How can I help you today?"
  );

  const selectedVoice = elements.voice.value;
  const voices = speechSynthesis.getVoices();
  const voice = voices.find((v) => v.name === selectedVoice);

  if (voice) {
    utterance.voice = voice;
  }

  utterance.rate = parseFloat(elements.speechRate.value);
  utterance.lang = elements.language.value;

  speechSynthesis.speak(utterance);
}

/**
 * Clear all stored data
 */
async function clearAllData(): Promise<void> {
  if (
    confirm(
      'Are you sure you want to clear all data? This cannot be undone.'
    )
  ) {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
    showToast('All data cleared', 'success');

    // Reload settings
    const settings = await storage.getSettings();
    populateForm(settings);
  }
}

/**
 * Save settings
 */
async function saveSettings(): Promise<void> {
  const settings: Partial<Settings> = {
    llmProvider: elements.llmProvider.value as Settings['llmProvider'],
    llmApiKey: elements.llmApiKey.value,
    llmModel: elements.llmModel.value,
    sttProvider: elements.sttProvider.value as Settings['sttProvider'],
    voice: elements.voice.value,
    language: elements.language.value,
    wakeWord: elements.wakeWord.value,
  };

  // Save to storage
  await storage.updateSettings(settings);

  // Show success toast
  showToast('Settings saved successfully!', 'success');
}

/**
 * Reset to default settings
 */
async function resetToDefaults(): Promise<void> {
  if (confirm('Reset all settings to defaults?')) {
    const defaults: Settings = {
      sttProvider: 'web-speech',
      llmProvider: 'groq',
      llmApiKey: '',
      llmModel: 'llama-3.3-70b-versatile',
      ttsProvider: 'browser',
      voice: '',
      language: 'en-US',
      wakeWord: 'Hey Sahayak',
      enableWakeWord: false,
    };

    await storage.updateSettings(defaults);
    populateForm(defaults);
    showToast('Settings reset to defaults', 'success');
  }
}

/**
 * Show toast notification
 */
function showToast(message: string, type: 'success' | 'error' = 'success'): void {
  elements.toastMessage.textContent = message;
  elements.toast.className = `toast ${type}`;
  elements.toast.classList.remove('hidden');

  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 3000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
