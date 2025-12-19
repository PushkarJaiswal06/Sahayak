# Chromium Contribution Guide

## How to Contribute to Chromium/Chrome

This guide walks through the process of contributing code to the Chromium project.

---

## Prerequisites

### 1. System Requirements

**Windows:**
- Windows 10/11 64-bit
- 16GB+ RAM (32GB recommended)
- 100GB+ free disk space
- Visual Studio 2022

**macOS:**
- macOS 10.15+
- Xcode 13+
- 16GB+ RAM
- 100GB+ free disk space

**Linux:**
- Ubuntu 18.04+ or similar
- 16GB+ RAM
- 100GB+ free disk space

### 2. Install depot_tools

```bash
# Clone depot_tools
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git

# Add to PATH
# Linux/macOS
export PATH="$PATH:$HOME/depot_tools"

# Windows (PowerShell)
$env:PATH += ";C:\src\depot_tools"
```

### 3. Configure Git

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
git config --global core.autocrlf false
git config --global core.filemode false
```

---

## Getting the Code

### 1. Create a Source Directory

```bash
mkdir ~/chromium && cd ~/chromium
```

### 2. Fetch Chromium Source

```bash
# This will take several hours
fetch --nohooks chromium

# Or for a partial checkout (faster)
fetch --nohooks --no-history chromium
```

### 3. Install Dependencies

```bash
cd src

# Linux
./build/install-build-deps.sh

# macOS
./build/install-build-deps.py

# Windows - run from elevated prompt
python3 build\vs_toolchain.py update
```

### 4. Run Hooks

```bash
gclient runhooks
```

---

## Building Chromium

### 1. Generate Build Files

```bash
# Create build directory
gn gen out/Default

# With specific flags
gn gen out/Default --args='is_debug=false is_component_build=true'
```

### 2. Common GN Arguments

Create `out/Default/args.gn`:

```gn
# Debug build
is_debug = true

# Component build (faster incremental builds)
is_component_build = true

# Disable some features for faster builds
enable_nacl = false
symbol_level = 1

# Use system libraries where possible (Linux)
use_sysroot = false
```

### 3. Build

```bash
# Build all of Chrome
autoninja -C out/Default chrome

# Build specific target
autoninja -C out/Default blink_tests
```

### 4. Run Chrome

```bash
# Linux/macOS
./out/Default/chrome

# Windows
out\Default\chrome.exe
```

---

## Making Changes

### 1. Create a Branch

```bash
git checkout -b voice-agent-api origin/main
```

### 2. Find the Right Location

For Voice Agent API, relevant directories include:

```
third_party/blink/renderer/modules/speech/
third_party/blink/public/mojom/speech/
content/browser/speech/
chrome/browser/speech/
```

### 3. Understand the Architecture

**Blink (Rendering Engine):**
- `third_party/blink/` - Web platform implementation
- `renderer/modules/` - JavaScript APIs
- `public/mojom/` - IPC interfaces

**Content (Browser Core):**
- `content/browser/` - Browser process code
- `content/renderer/` - Renderer process code
- `content/public/` - Public APIs

**Chrome (Browser UI):**
- `chrome/browser/` - Browser features
- `chrome/renderer/` - Renderer features

### 4. Code Style

Follow the [Chromium Style Guide](https://chromium.googlesource.com/chromium/src/+/main/styleguide/styleguide.md):

```cpp
// Good
class VoiceAgent final : public ScriptWrappable {
 public:
  static VoiceAgent* Create(ExecutionContext* context);
  
  void StartListening();
  void StopListening();
  
  // ScriptWrappable
  void Trace(Visitor* visitor) const override;
  
 private:
  explicit VoiceAgent(ExecutionContext* context);
  
  Member<ExecutionContext> context_;
  bool is_listening_ = false;
};

// Bad
class voiceAgent : public ScriptWrappable {
public:
  static voiceAgent* create(ExecutionContext* ctx);
  void startListening();
  void stopListening();
private:
  ExecutionContext* m_context;
  bool mIsListening;
};
```

### 5. Write Tests

```cpp
// third_party/blink/renderer/modules/speech/voice_agent_test.cc

#include "testing/gtest/include/gtest/gtest.h"
#include "third_party/blink/renderer/modules/speech/voice_agent.h"
#include "third_party/blink/renderer/core/testing/page_test_base.h"

namespace blink {

class VoiceAgentTest : public PageTestBase {
 protected:
  void SetUp() override {
    PageTestBase::SetUp();
    voice_agent_ = VoiceAgent::Create(GetDocument().GetExecutionContext());
  }
  
  VoiceAgent* voice_agent_;
};

TEST_F(VoiceAgentTest, InitialState) {
  EXPECT_FALSE(voice_agent_->isListening());
  EXPECT_FALSE(voice_agent_->isSpeaking());
  EXPECT_EQ(voice_agent_->state(), VoiceAgentState::kIdle);
}

TEST_F(VoiceAgentTest, StartListening) {
  voice_agent_->StartListening();
  EXPECT_TRUE(voice_agent_->isListening());
  EXPECT_EQ(voice_agent_->state(), VoiceAgentState::kListening);
}

}  // namespace blink
```

### 6. Run Tests

```bash
# Run specific test
autoninja -C out/Default blink_unittests
./out/Default/blink_unittests --gtest_filter="VoiceAgentTest.*"

# Run web platform tests
./third_party/blink/tools/run_web_tests.py -t Default speech/voice-agent/
```

---

## Code Review Process

### 1. Upload Change

```bash
# Create a change
git cl upload

# This will:
# 1. Run presubmit checks
# 2. Create a Gerrit CL
# 3. Open the CL in your browser
```

### 2. CL Description Format

```
[Speech] Add Voice Agent API for conversational AI

Add a new VoiceAgent API that enables web applications to create
conversational AI experiences with proper permission models.

Features:
- Speech recognition with interim results
- LLM integration for response generation
- Text-to-speech synthesis
- Action execution framework

Bug: 12345
Change-Id: I1234567890abcdef...
```

### 3. Find Reviewers

Look at `OWNERS` files in the directories you're modifying:

```bash
# Find owners
git log --oneline -10 third_party/blink/renderer/modules/speech/
```

Add reviewers who have recently worked on related code.

### 4. Address Review Comments

```bash
# Make changes
git add .
git commit --amend

# Upload new patchset
git cl upload
```

### 5. Land the Change

Once approved:

```bash
# Commit queue
git cl set-commit

# Or submit directly (if you have permission)
git cl land
```

---

## Specific: Adding Voice Agent API

### Step 1: Define the Interface (WebIDL)

```webidl
// third_party/blink/renderer/modules/speech/voice_agent.idl

[
  Exposed=Window,
  SecureContext
] interface VoiceAgent : EventTarget {
  [CallWith=ExecutionContext] constructor(VoiceAgentOptions options);
  
  readonly attribute VoiceAgentState state;
  readonly attribute boolean isListening;
  readonly attribute boolean isSpeaking;
  
  [RaisesException] Promise<void> start();
  [RaisesException] Promise<void> stop();
  [RaisesException] Promise<void> speak(DOMString text, optional SpeakOptions options = {});
  
  attribute EventHandler onstart;
  attribute EventHandler onstop;
  attribute EventHandler ontranscript;
  attribute EventHandler onresponse;
  attribute EventHandler onaction;
  attribute EventHandler onerror;
};

enum VoiceAgentState { "idle", "listening", "processing", "speaking" };

dictionary VoiceAgentOptions {
  DOMString language = "en-US";
  boolean continuous = true;
  boolean interimResults = true;
  DOMString aiProviderUrl;
  sequence<VoiceAgentCapability> capabilities;
};
```

### Step 2: Implement the Interface

```cpp
// third_party/blink/renderer/modules/speech/voice_agent.h

#ifndef THIRD_PARTY_BLINK_RENDERER_MODULES_SPEECH_VOICE_AGENT_H_
#define THIRD_PARTY_BLINK_RENDERER_MODULES_SPEECH_VOICE_AGENT_H_

#include "third_party/blink/renderer/bindings/core/v8/script_promise.h"
#include "third_party/blink/renderer/core/dom/events/event_target.h"
#include "third_party/blink/renderer/modules/modules_export.h"

namespace blink {

class ExecutionContext;
class VoiceAgentOptions;

class MODULES_EXPORT VoiceAgent final
    : public EventTargetWithInlineData,
      public ExecutionContextLifecycleObserver {
  DEFINE_WRAPPERTYPEINFO();

 public:
  static VoiceAgent* Create(ExecutionContext*, const VoiceAgentOptions*);
  
  VoiceAgent(ExecutionContext*, const VoiceAgentOptions*);
  ~VoiceAgent() override;

  // Attributes
  String state() const;
  bool isListening() const { return is_listening_; }
  bool isSpeaking() const { return is_speaking_; }

  // Methods
  ScriptPromise start(ScriptState*);
  ScriptPromise stop(ScriptState*);
  ScriptPromise speak(ScriptState*, const String& text, const SpeakOptions*);

  // Event handlers
  DEFINE_ATTRIBUTE_EVENT_LISTENER(start, kStart)
  DEFINE_ATTRIBUTE_EVENT_LISTENER(stop, kStop)
  DEFINE_ATTRIBUTE_EVENT_LISTENER(transcript, kTranscript)
  DEFINE_ATTRIBUTE_EVENT_LISTENER(response, kResponse)
  DEFINE_ATTRIBUTE_EVENT_LISTENER(action, kAction)
  DEFINE_ATTRIBUTE_EVENT_LISTENER(error, kError)

  // EventTarget
  const AtomicString& InterfaceName() const override;
  ExecutionContext* GetExecutionContext() const override;

  // ExecutionContextLifecycleObserver
  void ContextDestroyed() override;

  void Trace(Visitor*) const override;

 private:
  void OnSpeechResult(const String& transcript, bool is_final);
  void OnLLMResponse(const String& text, const String& action_plan);
  
  Member<SpeechRecognition> speech_recognition_;
  String ai_provider_url_;
  bool is_listening_ = false;
  bool is_speaking_ = false;
  VoiceAgentState state_ = VoiceAgentState::kIdle;
};

}  // namespace blink

#endif  // THIRD_PARTY_BLINK_RENDERER_MODULES_SPEECH_VOICE_AGENT_H_
```

### Step 3: Add to Build

```gn
# third_party/blink/renderer/modules/speech/BUILD.gn

blink_modules_sources("speech") {
  sources = [
    "speech_recognition.cc",
    "speech_recognition.h",
    "voice_agent.cc",  # Add this
    "voice_agent.h",   # Add this
  ]
  
  deps = [
    "//third_party/blink/renderer/bindings/modules/v8:v8",
    "//third_party/blink/renderer/core",
  ]
}
```

### Step 4: Add Feature Flag

```cpp
// third_party/blink/renderer/platform/runtime_enabled_features.json5

{
  name: "VoiceAgent",
  status: "experimental",
},
```

---

## Resources

### Documentation
- [Chromium Docs](https://chromium.googlesource.com/chromium/src/+/main/docs/)
- [Blink Architecture](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/README.md)
- [Contributing Guide](https://chromium.googlesource.com/chromium/src/+/main/docs/contributing.md)

### Communication
- Mailing List: chromium-dev@chromium.org
- IRC: #chromium on Libera.Chat
- Slack: chromium.slack.com

### Bug Tracker
- https://bugs.chromium.org/p/chromium/issues/list

---

## Tips for Success

1. **Start Small**: Begin with a bug fix to learn the process
2. **Read the Code**: Spend time understanding existing patterns
3. **Ask Questions**: The community is helpful, use mailing lists
4. **Be Patient**: Large changes take time to review
5. **Write Good Tests**: Test coverage is important
6. **Follow Style**: Use `git cl format` before uploading
