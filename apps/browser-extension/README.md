# Sahayak Voice Agent Browser Extension

🎤 **Voice-first web browsing powered by AI**

A browser extension that brings natural language voice control to any webpage. Talk to your browser to navigate, search, read content, and interact with web pages hands-free.

![Sahayak Voice Agent](public/icons/icon-128.svg)

## Features

- **🗣️ Voice Commands**: Control your browser using natural language
- **🧠 AI-Powered**: Uses Groq's fast LLM inference for intelligent responses
- **🔊 Text-to-Speech**: Hear responses spoken back to you
- **⌨️ Keyboard Shortcut**: Quick toggle with `Ctrl+Shift+V`
- **🌐 Works Everywhere**: Runs on any webpage
- **🔒 Privacy-First**: All processing happens locally or via your own API keys

## Quick Start

### Prerequisites

- Node.js 18 or later
- npm or pnpm
- Chrome/Chromium browser

### Installation

1. **Clone and install dependencies**
   ```bash
   cd apps/browser-extension
   npm install
   ```

2. **Build the extension**
   ```bash
   npm run build
   ```

3. **Load in Chrome**
   - Open `chrome://extensions`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `dist` folder

4. **Configure**
   - Click the extension icon
   - Go to Settings (⚙️)
   - Add your Groq API key (get one at [console.groq.com](https://console.groq.com))

### Development

Run in watch mode for hot reload:

```bash
npm run dev
```

## Usage

### Voice Commands

Simply speak naturally! The AI understands context and intent:

| Say | Action |
|-----|--------|
| "Go to GitHub" | Navigates to github.com |
| "Search for TypeScript tutorials" | Searches your query |
| "Click the sign in button" | Finds and clicks elements |
| "Scroll down" | Scrolls the page |
| "Read this article" | Reads page content aloud |
| "Go back" | Browser navigation |
| "What's on this page?" | Summarizes content |

### Keyboard Shortcut

Press `Ctrl+Shift+V` (or `Cmd+Shift+V` on Mac) to toggle voice input.

### Popup Interface

Click the extension icon to:
- Toggle voice input on/off
- See your transcript in real-time
- View AI responses
- Access quick suggestions

## Configuration

### LLM Providers

| Provider | Model | Notes |
|----------|-------|-------|
| **Groq** (default) | llama-3.3-70b-versatile | Fast, free tier available |
| OpenAI | gpt-4o, gpt-4o-mini | Requires API key |
| Anthropic | claude-3.5-sonnet | Requires API key |
| Local | Ollama | Self-hosted, no API key |

### Voice Settings

- **Speech Recognition**: Uses Web Speech API (free, no setup)
- **Text-to-Speech**: Browser's native voices
- **Language**: Supports 10+ languages
- **Speech Rate**: Adjustable 0.5x - 2x

## Architecture

```
src/
├── background/
│   ├── index.ts          # Service worker entry
│   ├── voice-agent.ts    # Core voice agent logic
│   └── storage.ts        # Settings management
├── content/
│   ├── index.ts          # Content script
│   ├── action-executor.ts # DOM action executor
│   └── styles.css        # UI styles
├── popup/
│   ├── popup.html        # Popup interface
│   ├── popup.ts          # Popup logic
│   └── popup.css         # Popup styles
└── options/
    ├── options.html      # Settings page
    ├── options.ts        # Settings logic
    └── options.css       # Settings styles
```

### Message Flow

```
User Voice → Web Speech API → Background (LLM) → Content Script → DOM
                                    ↓
                            Speech Synthesis ← AI Response
```

## Action Schema

The AI returns structured JSON actions:

```typescript
interface ActionResponse {
  response: string;        // Text to speak to user
  actions?: Array<{
    type: 'navigate' | 'click' | 'type' | 'scroll' | 'search' | 'read' | ...;
    selector?: string;     // CSS selector
    text?: string;         // Text to type or find
    url?: string;          // URL to navigate
    direction?: string;    // Scroll direction
    amount?: number;       // Scroll amount
  }>;
  suggestions?: string[];  // Follow-up suggestions
}
```

## Permissions

| Permission | Purpose |
|------------|---------|
| `activeTab` | Access current tab for actions |
| `storage` | Save settings and preferences |
| `scripting` | Inject content scripts |

## Troubleshooting

### Voice not working?
- Check microphone permissions in Chrome
- Ensure no other app is using the microphone
- Try refreshing the page

### No AI response?
- Verify your API key is correct
- Check the console for errors
- Try switching LLM providers

### Actions not executing?
- Some sites block content scripts
- Refresh the page and try again
- Check if the element selector is valid

## Contributing

We welcome contributions! See the main [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Install dependencies
npm install

# Run in dev mode
npm run dev

# Type checking
npm run typecheck

# Build for production
npm run build
```

## License

MIT License - see [LICENSE](../../LICENSE) for details.

---

Built with ❤️ by the Sahayak team
