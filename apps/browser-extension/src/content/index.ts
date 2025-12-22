// Sahayak Voice Agent - Content Script

import './styles.css';
import { ActionExecutor } from './action-executor';

const executor = new ActionExecutor();
let isListening = false;
let recognition: SpeechRecognition | null = null;
let synthesis: SpeechSynthesis | null = null;

// Initialize speech APIs
function initSpeech() {
  const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (SpeechRecognitionCtor) {
    recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1];
      const transcript = {
        text: result[0].transcript,
        isFinal: result.isFinal,
        confidence: result[0].confidence,
      };

      // Send to background for processing
      chrome.runtime.sendMessage({
        type: 'TRANSCRIPT',
        payload: transcript
      }).catch(() => {});

      showTranscript(transcript);

      // If final, send for processing
      if (result.isFinal && transcript.text.trim()) {
        chrome.runtime.sendMessage({
          type: 'PROCESS_TEXT',
          text: transcript.text
        }).catch(() => {});
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        showToast('⚠️ Speech recognition error: ' + event.error, 'error');
      }
    };

    recognition.onend = () => {
      // Auto-restart if still listening
      if (isListening && recognition) {
        try {
          recognition.start();
        } catch (e) {
          console.error('Failed to restart recognition:', e);
        }
      }
    };
  }

  synthesis = window.speechSynthesis;
}

initSpeech();

// Create UI elements
function createUI() {
  // Voice indicator
  const indicator = document.createElement('div');
  indicator.id = 'sahayak-voice-indicator';
  indicator.innerHTML = `
    <div class="sahayak-pill">
      <div class="sahayak-pulse"></div>
      <svg class="sahayak-mic" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
      </svg>
      <span class="sahayak-text">Listening...</span>
    </div>
  `;
  document.body.appendChild(indicator);

  // Toast for responses
  const toast = document.createElement('div');
  toast.id = 'sahayak-toast';
  document.body.appendChild(toast);
}

// Initialize UI
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createUI);
} else {
  createUI();
}

// Send page context to background
function sendPageContext() {
  const content = getPageContent();
  chrome.runtime.sendMessage({
    type: 'PAGE_CONTEXT',
    url: window.location.href,
    title: document.title,
    content,
  }).catch(() => {}); // Extension might not be ready
}

function getPageContent(): string {
  // Try to find main content
  const selectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '#content',
    '.main-content',
  ];

  let contentEl: Element | null = null;
  for (const selector of selectors) {
    contentEl = document.querySelector(selector);
    if (contentEl) break;
  }

  contentEl = contentEl || document.body;

  // Get text content, limiting to relevant parts
  const text = contentEl.textContent || '';
  return text.replace(/\s+/g, ' ').trim().slice(0, 5000);
}

// Handle messages from background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('📨 Content script received message:', message.type);
  switch (message.type) {
    case 'VOICE_STATUS':
      console.log('🔊 VOICE_STATUS:', message.payload.isListening);
      if (message.payload.isListening) {
        startListening();
      } else {
        stopListening();
      }
      break;

    case 'VOICE_TRANSCRIPT':
      showTranscript(message.payload);
      break;

    case 'VOICE_RESPONSE':
      showResponse(message.payload);
      // Speak the response
      if (synthesis && message.payload.text) {
        const utterance = new SpeechSynthesisUtterance(message.payload.text);
        utterance.lang = 'en-US';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        synthesis.speak(utterance);
      }
      break;

    case 'EXECUTE_ACTION':
      executor.execute(message.payload)
        .then((result: unknown) => sendResponse(result))
        .catch((error: unknown) => sendResponse({ success: false, error: (error as Error).message }));
      return true; // Keep channel open

    case 'GET_PAGE_CONTENT':
      sendResponse({ content: getPageContent() });
      break;
  }
});

function startListening() {
  console.log('🎤 startListening called');
  if (!recognition) {
    console.error('❌ Speech recognition not available');
    showToast('⚠️ Speech recognition not supported', 'error');
    return;
  }

  try {
    console.log('🎤 Starting speech recognition...');
    recognition.start();
    isListening = true;
    updateVoiceIndicator(true);
    console.log('✅ Speech recognition started');
  } catch (e) {
    console.error('❌ Failed to start recognition:', e);
    showToast('⚠️ Failed to start: ' + (e as Error).message, 'error');
  }
}

function stopListening() {
  if (recognition) {
    recognition.stop();
  }
  isListening = false;
  updateVoiceIndicator(false);
}

function updateVoiceIndicator(listening: boolean) {
  isListening = listening;
  const indicator = document.getElementById('sahayak-voice-indicator');
  if (indicator) {
    indicator.classList.toggle('active', listening);
  }
}

function showTranscript(transcript: { text: string; isFinal: boolean }) {
  const toast = document.getElementById('sahayak-toast');
  if (!toast) return;

  toast.innerHTML = `
    <div class="sahayak-toast-content">
      <span class="sahayak-toast-label">You${transcript.isFinal ? ' said' : ''}:</span>
      <span class="sahayak-toast-text">${transcript.text}</span>
    </div>
  `;
  toast.classList.add('visible');

  if (transcript.isFinal) {
    setTimeout(() => {
      toast.classList.remove('visible');
    }, 3000);
  }
}

function showResponse(response: { text: string; suggestions?: string[] }) {
  const toast = document.getElementById('sahayak-toast');
  if (!toast) return;

  let suggestionsHtml = '';
  if (response.suggestions?.length) {
    suggestionsHtml = `
      <div class="sahayak-suggestions">
        ${response.suggestions.map(s => `<button class="sahayak-suggestion">${s}</button>`).join('')}
      </div>
    `;
  }

  toast.innerHTML = `
    <div class="sahayak-toast-content response">
      <span class="sahayak-toast-label">Sahayak:</span>
      <span class="sahayak-toast-text">${response.text}</span>
      ${suggestionsHtml}
    </div>
  `;
  toast.classList.add('visible');

  // Add click handlers for suggestions
  toast.querySelectorAll('.sahayak-suggestion').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = btn.textContent || '';
      chrome.runtime.sendMessage({ type: 'PROCESS_TEXT', text });
    });
  });

  setTimeout(() => {
    toast.classList.remove('visible');
  }, 8000);
}

function showToast(message: string, type: 'info' | 'error' = 'info') {
  const toast = document.getElementById('sahayak-toast');
  if (!toast) return;

  toast.innerHTML = `
    <div class="sahayak-toast-content ${type}">
      <span class="sahayak-toast-text">${message}</span>
    </div>
  `;
  toast.classList.add('visible');

  setTimeout(() => {
    toast.classList.remove('visible');
  }, 3000);
}

// Send initial page context
sendPageContext();

// Update context on navigation (SPA support)
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    setTimeout(sendPageContext, 500); // Wait for content to load
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Also send on visibility change
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    sendPageContext();
  }
});

console.log('✅ Sahayak Voice Agent content script loaded');
console.log('🎤 Speech Recognition available:', !!recognition);
