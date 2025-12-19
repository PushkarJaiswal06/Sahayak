// Sahayak Voice Agent - Background Service Worker

import { VoiceAgentManager } from './voice-agent';
import { StorageManager } from './storage';

const voiceAgent = new VoiceAgentManager();
const storage = new StorageManager();

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Sahayak Voice Agent installed');
  
  // Set default settings
  await storage.setDefaults({
    sttProvider: 'web-speech',
    llmProvider: 'groq',
    ttsProvider: 'browser',
    voice: 'en-US',
    language: 'en-US',
    wakeWord: 'hey sahayak',
    enableWakeWord: false,
  });
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-voice') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await toggleVoice(tab.id);
    }
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message: any, sender: chrome.runtime.MessageSender) {
  const tabId = sender.tab?.id;
  
  switch (message.type) {
    case 'TOGGLE_VOICE':
      if (tabId) {
        return await toggleVoice(tabId);
      }
      break;
      
    case 'GET_STATUS':
      return {
        isListening: voiceAgent.isListening,
        isProcessing: voiceAgent.isProcessing,
        isSpeaking: voiceAgent.isSpeaking,
      };
      
    case 'PROCESS_TEXT':
      return await voiceAgent.processText(message.text);
      
    case 'PAGE_CONTEXT':
      voiceAgent.setPageContext({
        url: message.url,
        title: message.title,
        content: message.content,
      });
      return { success: true };
      
    case 'GET_SETTINGS':
      return await storage.getAll();
      
    case 'SAVE_SETTINGS':
      await storage.set(message.settings);
      await voiceAgent.updateConfig(message.settings);
      return { success: true };
      
    case 'TRANSCRIPT':
      // Forward transcript to popup
      chrome.runtime.sendMessage({
        type: 'TRANSCRIPT_UPDATE',
        payload: message.payload,
      }).catch(() => {}); // Popup might be closed
      return { success: true };
      
    default:
      console.warn('Unknown message type:', message.type);
      return { error: 'Unknown message type' };
  }
}

async function toggleVoice(tabId: number) {
  const isNowListening = await voiceAgent.toggle();
  
  // Update icon
  updateIcon(isNowListening);
  
  // Notify content script
  chrome.tabs.sendMessage(tabId, {
    type: 'VOICE_STATUS',
    payload: { isListening: isNowListening },
  }).catch(() => {}); // Tab might not have content script
  
  return { isListening: isNowListening };
}

function updateIcon(active: boolean) {
  chrome.action.setIcon({
    path: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': active ? 'icons/icon-128-active.png' : 'icons/icon-128.png',
    },
  });
}

// Forward voice agent events to active tab
voiceAgent.on('transcript', async (transcript: unknown) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'VOICE_TRANSCRIPT',
      payload: transcript,
    }).catch(() => {});
  }
  
  // Also notify popup
  chrome.runtime.sendMessage({
    type: 'TRANSCRIPT_UPDATE',
    payload: transcript,
  }).catch(() => {});
});

voiceAgent.on('response', async (response: unknown) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'VOICE_RESPONSE',
      payload: response,
    }).catch(() => {});
  }
  
  chrome.runtime.sendMessage({
    type: 'RESPONSE_UPDATE',
    payload: response,
  }).catch(() => {});
});

voiceAgent.on('action', async (action: unknown) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'EXECUTE_ACTION',
      payload: action,
    }).catch(() => {});
  }
});

voiceAgent.on('stateChange', (state: unknown) => {
  chrome.runtime.sendMessage({
    type: 'STATE_CHANGE',
    payload: state,
  }).catch(() => {});
});

console.log('Sahayak Voice Agent background service worker started');
