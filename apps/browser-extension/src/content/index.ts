// Sahayak Voice Agent - Content Script

import { ActionExecutor } from './action-executor';

const executor = new ActionExecutor();
let isListening = false;

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
  switch (message.type) {
    case 'VOICE_STATUS':
      updateVoiceIndicator(message.payload.isListening);
      break;

    case 'VOICE_TRANSCRIPT':
      showTranscript(message.payload);
      break;

    case 'VOICE_RESPONSE':
      showResponse(message.payload);
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

console.log('Sahayak Voice Agent content script loaded');
