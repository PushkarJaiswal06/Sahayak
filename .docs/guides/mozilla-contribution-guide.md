# Mozilla Firefox Contribution Guide

## How to Contribute to Firefox/Gecko

This guide walks through the process of contributing code to the Mozilla Firefox project.

---

## Prerequisites

### 1. System Requirements

**Windows:**
- Windows 10/11 64-bit
- 8GB+ RAM (16GB recommended)
- 40GB+ free disk space
- Visual Studio 2019 or 2022

**macOS:**
- macOS 10.15+
- Xcode Command Line Tools
- 8GB+ RAM
- 40GB+ free disk space

**Linux:**
- Ubuntu 20.04+ or Fedora 34+
- 8GB+ RAM
- 40GB+ free disk space

### 2. Install Prerequisites

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install build-essential python3 python3-pip git mercurial
```

**Linux (Fedora):**
```bash
sudo dnf install @development-tools python3 python3-pip git mercurial
```

**macOS:**
```bash
xcode-select --install
brew install mercurial python3
```

**Windows:**
```powershell
# Install MozillaBuild
# Download from: https://ftp.mozilla.org/pub/mozilla/libraries/win32/MozillaBuildSetup-Latest.exe
```

### 3. Bootstrap the Build Environment

```bash
# Clone mozilla-central (or use mozilla-unified for all branches)
curl https://hg.mozilla.org/mozilla-central/raw-file/default/python/mozboot/bin/bootstrap.py -O
python3 bootstrap.py

# Or use Git mirror
git clone https://github.com/nickstenning/gecko-dev.git
cd gecko-dev
./mach bootstrap
```

---

## Getting the Code

### Option 1: Mercurial (Recommended)

```bash
# Clone mozilla-central
hg clone https://hg.mozilla.org/mozilla-central/

# Or mozilla-unified (includes all branches)
hg clone https://hg.mozilla.org/mozilla-unified/
cd mozilla-unified
hg update central
```

### Option 2: Git

```bash
# Clone the Git mirror
git clone https://github.com/nickstenning/gecko-dev.git
cd gecko-dev
```

---

## Building Firefox

### 1. Create mozconfig

Create `mozconfig` in the source root:

```bash
# Build Firefox (browser)
ac_add_options --enable-application=browser

# Debug build (faster builds, more logs)
ac_add_options --enable-debug
ac_add_options --disable-optimize

# Or Release build (slower builds, faster runtime)
# ac_add_options --disable-debug
# ac_add_options --enable-optimize

# Faster builds
ac_add_options --with-ccache=sccache
mk_add_options MOZ_OBJDIR=@TOPSRCDIR@/obj-ff-debug

# Component build for faster linking
ac_add_options --enable-linker=lld
```

### 2. Build

```bash
# Bootstrap (first time only)
./mach bootstrap

# Build
./mach build

# Or build specific component
./mach build browser/components/voiceassistant
```

### 3. Run Firefox

```bash
./mach run

# With specific profile
./mach run --profile /path/to/profile

# With debug output
./mach run --debug
```

---

## Making Changes

### 1. Create a Bug

Before making changes, file a bug on Bugzilla:

1. Go to https://bugzilla.mozilla.org
2. Click "New Bug"
3. Select appropriate product/component
4. Describe the feature/bug

Example for Voice Assistant:

```
Product: Firefox
Component: General (or create new: Voice)
Summary: [meta] Implement Voice Agent API for Firefox

Description:
This bug tracks the implementation of a Voice Agent API for Firefox
that enables web applications to create conversational AI experiences.

See full proposal: [link to proposal]
```

### 2. Find the Right Location

For Voice Assistant, relevant directories include:

```
browser/components/voiceassistant/     # New component
dom/media/webrtc/                      # Audio capture
dom/webidl/                            # WebIDL definitions
modules/libpref/init/StaticPrefList.yaml  # Preferences
```

### 3. Create New Files

**WebIDL Definition:**
```webidl
// dom/webidl/VoiceAgent.webidl

[Exposed=Window, SecureContext, Pref="dom.voiceagent.enabled"]
interface VoiceAgent : EventTarget {
  [Throws]
  constructor(VoiceAgentOptions options);
  
  readonly attribute VoiceAgentState state;
  readonly attribute boolean isListening;
  readonly attribute boolean isSpeaking;
  
  [Throws]
  Promise<undefined> start();
  [Throws]
  Promise<undefined> stop();
  [Throws]
  Promise<undefined> speak(DOMString text, optional SpeakOptions options = {});
  
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
  DOMString aiProviderUrl = "";
  sequence<VoiceAgentCapability> capabilities = [];
};
```

**Implementation:**
```cpp
// browser/components/voiceassistant/VoiceAgent.cpp

#include "VoiceAgent.h"
#include "mozilla/dom/VoiceAgentBinding.h"
#include "mozilla/dom/Promise.h"
#include "nsContentUtils.h"

namespace mozilla::dom {

NS_IMPL_CYCLE_COLLECTION_WRAPPERCACHE(VoiceAgent, mOwner)
NS_IMPL_CYCLE_COLLECTING_ADDREF(VoiceAgent)
NS_IMPL_CYCLE_COLLECTING_RELEASE(VoiceAgent)

NS_INTERFACE_MAP_BEGIN_CYCLE_COLLECTION(VoiceAgent)
  NS_WRAPPERCACHE_INTERFACE_MAP_ENTRY
  NS_INTERFACE_MAP_ENTRY(nsISupports)
NS_INTERFACE_MAP_END

/* static */
already_AddRefed<VoiceAgent> VoiceAgent::Constructor(
    const GlobalObject& aGlobal,
    const VoiceAgentOptions& aOptions,
    ErrorResult& aRv) {
  nsCOMPtr<nsPIDOMWindowInner> window = 
      do_QueryInterface(aGlobal.GetAsSupports());
  if (!window) {
    aRv.Throw(NS_ERROR_FAILURE);
    return nullptr;
  }

  RefPtr<VoiceAgent> agent = new VoiceAgent(window, aOptions);
  return agent.forget();
}

VoiceAgent::VoiceAgent(nsPIDOMWindowInner* aWindow,
                       const VoiceAgentOptions& aOptions)
    : mOwner(aWindow),
      mLanguage(aOptions.mLanguage),
      mContinuous(aOptions.mContinuous),
      mInterimResults(aOptions.mInterimResults),
      mAiProviderUrl(aOptions.mAiProviderUrl),
      mState(VoiceAgentState::Idle),
      mIsListening(false),
      mIsSpeaking(false) {
  // Initialize speech recognition
  mSpeechRecognition = SpeechRecognition::Constructor(
      aWindow->AsGlobal(), aRv);
  
  if (mSpeechRecognition) {
    mSpeechRecognition->SetContinuous(mContinuous);
    mSpeechRecognition->SetInterimResults(mInterimResults);
    mSpeechRecognition->SetLang(mLanguage);
    
    // Set up event listeners
    mSpeechRecognition->SetOnresult(
        new SpeechResultHandler(this));
    mSpeechRecognition->SetOnerror(
        new SpeechErrorHandler(this));
  }
}

already_AddRefed<Promise> VoiceAgent::Start(ErrorResult& aRv) {
  nsCOMPtr<nsIGlobalObject> global = do_QueryInterface(mOwner);
  if (!global) {
    aRv.Throw(NS_ERROR_FAILURE);
    return nullptr;
  }

  RefPtr<Promise> promise = Promise::Create(global, aRv);
  if (aRv.Failed()) {
    return nullptr;
  }

  if (mIsListening) {
    promise->MaybeResolve(JS::UndefinedHandleValue);
    return promise.forget();
  }

  // Start speech recognition
  if (mSpeechRecognition) {
    mSpeechRecognition->Start(aRv);
    if (aRv.Failed()) {
      return nullptr;
    }
    
    mIsListening = true;
    mState = VoiceAgentState::Listening;
    
    // Dispatch start event
    DispatchEvent(*Event::Create(this, u"start"_ns));
  }

  promise->MaybeResolve(JS::UndefinedHandleValue);
  return promise.forget();
}

void VoiceAgent::OnSpeechResult(const nsAString& aTranscript, bool aIsFinal) {
  // Create transcript event
  VoiceAgentTranscriptEventInit init;
  init.mTranscript = aTranscript;
  init.mIsFinal = aIsFinal;
  
  RefPtr<VoiceAgentTranscriptEvent> event =
      VoiceAgentTranscriptEvent::Constructor(this, u"transcript"_ns, init);
  
  DispatchEvent(*event);
  
  if (aIsFinal) {
    // Process with LLM
    ProcessWithLLM(aTranscript);
  }
}

}  // namespace mozilla::dom
```

### 4. Add to Build System

**moz.build:**
```python
# browser/components/voiceassistant/moz.build

DIRS += []

EXPORTS.mozilla.dom += [
    'VoiceAgent.h',
]

UNIFIED_SOURCES += [
    'VoiceAgent.cpp',
]

include('/ipc/chromium/chromium-config.mozbuild')

FINAL_LIBRARY = 'xul'
```

**Add to parent moz.build:**
```python
# browser/components/moz.build

DIRS += [
    # ... existing components ...
    'voiceassistant',
]
```

### 5. Add Preference

```yaml
# modules/libpref/init/StaticPrefList.yaml

# VoiceAgent API
- name: dom.voiceagent.enabled
  type: RelaxedAtomicBool
  value: false
  mirror: always
```

---

## Code Style

Mozilla uses its own style guide. Key points:

### C++ Style

```cpp
// Good Mozilla style
namespace mozilla::dom {

class VoiceAgent final : public nsISupports,
                         public nsWrapperCache {
 public:
  NS_DECL_CYCLE_COLLECTING_ISUPPORTS
  NS_DECL_CYCLE_COLLECTION_SCRIPT_HOLDER_CLASS(VoiceAgent)

  explicit VoiceAgent(nsPIDOMWindowInner* aWindow);

  // Methods use PascalCase
  void StartListening();
  void StopListening();
  bool IsListening() const { return mIsListening; }

 private:
  ~VoiceAgent() = default;

  // Members prefixed with 'm'
  nsCOMPtr<nsPIDOMWindowInner> mOwner;
  bool mIsListening = false;
};

}  // namespace mozilla::dom
```

### JavaScript Style

```javascript
// Good Mozilla JS style
const VoiceAssistant = {
  _isListening: false,

  async init() {
    this._setupEventListeners();
  },

  async startListening() {
    if (this._isListening) {
      return;
    }

    try {
      await this._recognition.start();
      this._isListening = true;
    } catch (error) {
      console.error("Failed to start listening:", error);
    }
  },
};
```

### Format Code

```bash
# Format C++ code
./mach clang-format -p path/to/file.cpp

# Check all formatting
./mach lint
```

---

## Testing

### 1. Write Tests

**xpcshell test:**
```javascript
// browser/components/voiceassistant/test/unit/test_voice_agent.js

"use strict";

const { VoiceAgent } = ChromeUtils.importESModule(
  "resource://gre/modules/VoiceAgent.sys.mjs"
);

add_task(async function test_initial_state() {
  const agent = new VoiceAgent({
    language: "en-US",
    continuous: true,
  });
  
  Assert.equal(agent.state, "idle");
  Assert.equal(agent.isListening, false);
  Assert.equal(agent.isSpeaking, false);
});

add_task(async function test_start_listening() {
  const agent = new VoiceAgent({});
  
  await agent.start();
  
  Assert.equal(agent.state, "listening");
  Assert.equal(agent.isListening, true);
});
```

**mochitest:**
```html
<!-- browser/components/voiceassistant/test/browser/browser_voice_agent.js -->

"use strict";

add_task(async function test_voice_agent_creation() {
  await BrowserTestUtils.withNewTab("about:blank", async browser => {
    const result = await SpecialPowers.spawn(browser, [], async () => {
      const agent = new content.VoiceAgent({
        language: "en-US",
      });
      return agent.state;
    });
    
    Assert.equal(result, "idle");
  });
});
```

### 2. Run Tests

```bash
# Run xpcshell tests
./mach xpcshell-test browser/components/voiceassistant/test/unit/

# Run mochitests
./mach mochitest browser/components/voiceassistant/test/browser/

# Run specific test
./mach test browser/components/voiceassistant/test/unit/test_voice_agent.js

# Run all tests in a directory
./mach test browser/components/voiceassistant/
```

---

## Code Review Process

### 1. Create a Patch

```bash
# Using Mercurial
hg commit -m "Bug 12345 - Add Voice Agent API for conversational AI. r=reviewer"

# Or using Git
git commit -m "Bug 12345 - Add Voice Agent API for conversational AI. r=reviewer"
```

### 2. Submit for Review

**Using Phabricator (moz-phab):**

```bash
# Install moz-phab
pip install MozPhab

# Configure
moz-phab setup

# Submit
moz-phab submit
```

**Commit Message Format:**

```
Bug 12345 - Add Voice Agent API for conversational AI. r=reviewer

This patch adds a new VoiceAgent API that enables web applications
to create conversational AI experiences with proper permission models.

Differential Revision: https://phabricator.services.mozilla.com/D12345
```

### 3. Find Reviewers

Look at `moz.build` files for module owners:

```python
# browser/components/voiceassistant/moz.build
with Files("**"):
    BUG_COMPONENT = ("Firefox", "Voice")
    
# Owners file
OWNERS = [
    "email@mozilla.com",
]
```

### 4. Address Review Feedback

```bash
# Make changes
./mach lint
./mach test browser/components/voiceassistant/

# Update patch (Mercurial)
hg commit --amend

# Update patch (Git)
git commit --amend

# Re-submit
moz-phab submit
```

### 5. Land the Change

Once approved, the patch will be landed by the reviewer or through automation:

```bash
# Auto-land via Phabricator
# Click "Land Commits" button in Phabricator

# Or manually (if you have permission)
./mach land
```

---

## Resources

### Documentation
- [Mozilla Source Docs](https://firefox-source-docs.mozilla.org/)
- [MDN Web Docs](https://developer.mozilla.org/)
- [Searchfox (Code Search)](https://searchfox.org/)

### Communication
- Matrix: #introduction:mozilla.org
- Discourse: https://discourse.mozilla.org/
- Mailing Lists: https://lists.mozilla.org/

### Bug Tracker
- https://bugzilla.mozilla.org

---

## Tips for Success

1. **Start with Good First Bugs**: Search for "good first bug" in Bugzilla
2. **Join Matrix Channels**: #introduction and relevant component channels
3. **Read Existing Code**: Study similar implementations
4. **Ask Questions Early**: Mozilla community is very welcoming
5. **Be Patient**: Review can take time, especially for large changes
6. **Write Good Documentation**: Inline comments and design docs help reviews
