// Sahayak Voice Agent - Popup Script

// Elements
const toggleBtn = document.getElementById('toggle-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const transcriptEl = document.getElementById('transcript') as HTMLDivElement;
const responseEl = document.getElementById('response') as HTMLDivElement;
const suggestionsEl = document.getElementById('suggestions') as HTMLDivElement;
const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;

let isListening = false;

// Initialize
async function init() {
  // Get current status
  const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
  updateUI(status.isListening);
}

// Event listeners
toggleBtn.addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ type: 'TOGGLE_VOICE' });
  updateUI(response.isListening);
});

settingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Listen for updates from background
chrome.runtime.onMessage.addListener((message) => {
  switch (message.type) {
    case 'TRANSCRIPT_UPDATE':
      showTranscript(message.payload);
      break;
    case 'RESPONSE_UPDATE':
      showResponse(message.payload);
      break;
    case 'STATE_CHANGE':
      handleStateChange(message.payload);
      break;
  }
});

function updateUI(listening: boolean) {
  isListening = listening;
  toggleBtn.classList.toggle('active', listening);
  toggleBtn.querySelector('.btn-text')!.textContent = listening ? 'Stop Listening' : 'Start Listening';
  
  if (listening) {
    statusEl.textContent = 'Listening...';
    statusEl.classList.add('listening');
  } else {
    statusEl.innerHTML = 'Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> to toggle';
    statusEl.classList.remove('listening');
  }
}

function showTranscript(transcript: { text: string; isFinal: boolean }) {
  transcriptEl.classList.remove('hidden');
  const textEl = transcriptEl.querySelector('.transcript-text') as HTMLDivElement;
  textEl.textContent = transcript.text;
  
  if (!transcript.isFinal) {
    textEl.classList.add('interim');
  } else {
    textEl.classList.remove('interim');
  }
}

function showResponse(response: { text: string; suggestions?: string[] }) {
  responseEl.classList.remove('hidden');
  const textEl = responseEl.querySelector('.response-text') as HTMLDivElement;
  textEl.textContent = response.text;

  // Show suggestions
  if (response.suggestions?.length) {
    suggestionsEl.classList.remove('hidden');
    suggestionsEl.innerHTML = response.suggestions
      .map(s => `<button class="suggestion-btn">${s}</button>`)
      .join('');
    
    // Add click handlers
    suggestionsEl.querySelectorAll('.suggestion-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const text = btn.textContent || '';
        chrome.runtime.sendMessage({ type: 'PROCESS_TEXT', text });
      });
    });
  } else {
    suggestionsEl.classList.add('hidden');
  }
}

function handleStateChange(state: { previous: string; current: string }) {
  const { current } = state;
  
  if (current === 'processing') {
    statusEl.textContent = 'Processing...';
  } else if (current === 'speaking') {
    statusEl.textContent = 'Speaking...';
  } else if (current === 'listening') {
    statusEl.textContent = 'Listening...';
    statusEl.classList.add('listening');
  } else if (current === 'idle') {
    updateUI(false);
  }
}

// Initialize popup
init();
