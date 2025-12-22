// Voice Agent Manager - Handles LLM processing and TTS coordination
// Note: SpeechRecognition runs in content script (not available in service workers)

type VoiceAgentState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface Transcript {
  text: string;
  isFinal: boolean;
  confidence: number;
}

interface Response {
  text: string;
  actions?: Action[];
  suggestions?: string[];
}

interface Action {
  type: string;
  params?: Record<string, unknown>;
}

interface PageContext {
  url: string;
  title: string;
  content: string;
}

type EventCallback = (...args: unknown[]) => void;

export class VoiceAgentManager {
  private state: VoiceAgentState = 'idle';
  private pageContext: PageContext | null = null;
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private events: Map<string, EventCallback[]> = new Map();
  
  // Config
  private config = {
    llmApiKey: '',
    llmProvider: 'groq',
    llmModel: 'llama-3.3-70b-versatile',
    voice: 'en-US',
    language: 'en-US',
  };

  constructor() {
    this.loadConfig();
  }

  get isListening(): boolean {
    return this.state === 'listening';
  }

  get isProcessing(): boolean {
    return this.state === 'processing';
  }

  get isSpeaking(): boolean {
    return this.state === 'speaking';
  }

  async loadConfig() {
    const result = await chrome.storage.sync.get([
      'llmApiKey',
      'llmProvider', 
      'llmModel',
      'voice',
      'language',
    ]);
    Object.assign(this.config, result);
  }

  async updateConfig(newConfig: Partial<typeof this.config>) {
    Object.assign(this.config, newConfig);
  }

  on(event: string, callback: EventCallback) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
  }

  private emit(event: string, ...args: any[]) {
    const callbacks = this.events.get(event) || [];
    callbacks.forEach(cb => cb(...args));
  }

  private setState(newState: VoiceAgentState) {
    const previous = this.state;
    this.state = newState;
    this.emit('stateChange', { previous, current: newState });
  }

  async toggle(): Promise<boolean> {
    if (this.state === 'listening') {
      this.setState('idle');
      return false;
    } else {
      this.setState('listening');
      return true;
    }
  }

  setPageContext(context: PageContext) {
    this.pageContext = context;
  }

  async processText(text: string): Promise<Response> {
    this.setState('processing');

    try {
      // Add user message to history
      this.conversationHistory.push({ role: 'user', content: text });

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt();

      // Call LLM
      const llmResponse = await this.callLLM(systemPrompt, this.conversationHistory);

      // Parse response
      const response = this.parseResponse(llmResponse);

      // Add assistant response to history
      this.conversationHistory.push({ role: 'assistant', content: response.text });

      this.emit('response', response);

      // Execute actions
      if (response.actions) {
        for (const action of response.actions) {
          this.emit('action', action);
        }
      }

      // Return to listening state (TTS handled by content script)
      this.setState('listening');

      return response;
    } catch (error) {
      this.emit('error', error);
      this.setState('idle');
      throw error;
    }
  }



  private buildSystemPrompt(): string {
    let prompt = `You are Sahayak, a helpful voice assistant for web browsing. You help users navigate websites, find information, and interact with web pages.

IMPORTANT: Always respond in this JSON format:
{
  "response": "Your spoken response to the user",
  "actions": [{"type": "action_type", "params": {...}}],
  "suggestions": ["Follow-up suggestion 1", "Follow-up suggestion 2"]
}

Available actions:
- navigate: Go to URL. Params: { url: string }
- click: Click element. Params: { selector?: string, text?: string }
- type: Type into input. Params: { selector: string, text: string }
- scroll: Scroll page. Params: { direction: "up"|"down", amount?: number }
- goBack: Go back in history
- goForward: Go forward in history
- search: Search page. Params: { query: string }
- read: Read element text. Params: { selector: string }

Be concise and helpful. Respond naturally as if speaking.`;

    if (this.pageContext) {
      prompt += `\n\nCurrent page:
URL: ${this.pageContext.url}
Title: ${this.pageContext.title}
Content preview: ${this.pageContext.content.slice(0, 2000)}...`;
    }

    return prompt;
  }

  private async callLLM(systemPrompt: string, messages: Array<{ role: string; content: string }>): Promise<string> {
    if (!this.config.llmApiKey) {
      // Return a helpful message if no API key
      return JSON.stringify({
        response: "I need an API key to process your request. Please add your Groq API key in the extension settings.",
        actions: [],
        suggestions: ["Open settings", "Get API key from groq.com"]
      });
    }

    const endpoint = this.config.llmProvider === 'groq' 
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.llmApiKey}`,
      },
      body: JSON.stringify({
        model: this.config.llmModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private parseResponse(llmResponse: string): Response {
    try {
      // Try to extract JSON from the response
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          text: parsed.response || parsed.text || llmResponse,
          actions: parsed.actions,
          suggestions: parsed.suggestions,
        };
      }
    } catch {
      // If JSON parsing fails, use as plain text
    }
    return { text: llmResponse };
  }

  clearHistory() {
    this.conversationHistory = [];
  }
}
