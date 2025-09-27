# LiveVideoTranslation
A chrome extension that assists real-time translation of live video calls, enabling instant translation on audio transmissions, translating speech in real-time for the output users.


# How to Install
1. Download Docker for Local Hosting
2. Clone git then load the folder as unpacked in Chrome (Developer Mode).
2. Open Google Meet, use the popup to **Start Listening**.
3. Configure translation endpoints (see below).

# Self-hosted LibreTranslate
Because public LibreTranslate mirrors now require API keys we can ship a local server with Docker instead:

## Quick start (macOS/Linux)
```bash
cd self-host
./run-server.sh
```

## Quick start (Windows PowerShell)
```powershell
cd self-host
./run-server.ps1
```

This launches the official `libretranslate/libretranslate` container on `http://localhost:{PORT}/translate`. You will see the port in the terminal once you run the above commands.

Under the popup’s **Translation API endpoints** field, enter:
```
http://localhost:<chosen-port>/translate
```
Click **Save Endpoints**, optionally **Test Endpoint**, then start listening.

# Documentation

## `manifest.json`

**MV3 Config Keys:**

- `background.service_worker`: `background.js`
- `web_accessible_resources`: `content.js`, `page.js`
- `permissions`:  
  - `activeTab`  
  - `scripting`  
  - `storage`
- `host_permissions`:  
  - LibreTranslate endpoints  
  - Google Meet

---

## `background.js`

Translation relay and debug flag persistence.  
**Imports:** `translator.js`, `language-mapper.js` via `importScripts`.

**Message Handler:**

- `__audioTranslatorDebug`: toggles persisted `DEBUG`
- `__audioTranslatorBg`:  
  - calls `translateViaEndpoints`  
  - maps languages via `mapToProviderLang`

---

## `content.js`

Overlay UI, `SpeechRecognition` (when available), bridge to page script when not.  
Injects `page.js` via `chrome.runtime.getURL('page.js')` if needed.

**Functions:**

- `translateText(text, source, target)`:  
  Sends to background and tracks latency/HUD stats.

**Features:**

- Overlays appear on the page
- HUD hotkeys:
  - `Ctrl/Cmd + D`: toggle HUD  
  - `Ctrl/Cmd + B`: toggle debug logging
- Handles messages: `START`, `STOP`, `CONFIG`
- Shows toasts

---

## `page.js`

Page-context `SpeechRecognition` handler for environments where content scripts cannot access it.

**Behavior:**

- Creates recognition
- Posts input transcript toast and translated toast via window messaging
- Bridges translation via content script using `__audioTranslatorTranslate` handshake

---

## `popup.js`

User UI for starting/stopping and selecting languages.

**Functions:**

- `ensureContentScript()`:  
  Injects `content.js` via `chrome.scripting.executeScript`
- `sendControl(type)`:  
  Sends `START`/`STOP`
- Prefs helpers:  
  Saves to `chrome.storage.sync`, broadcasts `CONFIG`

---

## `translator.js`

Parallel endpoint racer for LibreTranslate-style APIs.

**Function:**

- `translateViaEndpoints({ text, source, target, endpoints, timeoutMs, fetchImpl })`:  
  Returns first success or `{ ok: false }`

**Exposes:**

- `DEFAULT_ENDPOINTS`

---

## `language-mapper.js`

**BCP-47 (IETF language tag)** mapper.

**Functions:**

- Maps BCP-47/aliases to provider codes
- `mapToProviderLang(input)`: returns `auto` or base/alias

---

## Tests

### `tests/translator.test.js`

Node-based test of:

- Success
- Fallback
- Invalid args (using mock `fetch`)

### `tests/language-mapper.test.js`

Node-based test verifying:

- Mapping logic
- Edge cases