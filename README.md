# LiveVideoTranslation
A chrome extension that assists real-time translation of live video calls, enabling instant translation on audio transmissions, translating speech in real-time for the output users.


# How to Install
Load unpacked in Chrome → this folder.
Open a site tab, use popup to Start Listening.
If content cannot access SpeechRecognition, it injects page.js and handles recognition in main world. Overlays appear on the page; use Ctrl/Cmd+Alt+D to toggle HUD, Ctrl/Cmd+Alt+B to toggle debug logging.

# Documentation 
manifest.json: 
    MV3 config.Keys:
    background.service_worker: background.js
    web_accessible_resources: content.js, page.js
    permissions: activeTab, scripting, storage
    host_permissions: LibreTranslate endpoints and Google Meet
background.js: 
    Translation relay and debug flag persistence.
    Imports: translator.js, language-mapper.js via importScripts.
    Message handler:
    __audioTranslatorDebug: toggles persisted DEBUG.
    __audioTranslatorBg: calls translateViaEndpoints, maps languages via mapToProviderLang.
content.js: 
    Overlay UI, SpeechRecognition (when available), bridge to page script when not.
    Injects page.js via chrome.runtime.getURL('page.js') if needed.
    translateText(text, source, target): sends to background and tracks latency/HUD stats.
    Handles messages START, STOP, CONFIG; shows toasts; HUD hotkeys (Ctrl/Cmd+Alt+D/B).
page.js: 
    Page-context SpeechRecognition handler for environments where content scripts cannot access it.
    Creates recognition; posts input transcript toast and translated toast via window messaging.
    Bridges translation via content script using __audioTranslatorTranslate handshake.
popup.js: 
    User UI for starting/stopping and selecting languages.
    ensureContentScript(): injects content.js via chrome.scripting.executeScript.
    sendControl(type): sends START/STOP.
    Prefs helpers: saves to chrome.storage.sync, broadcasts CONFIG.
translator.js: 
    Parallel endpoint racer for LibreTranslate-style APIs.
    translateViaEndpoints({ text, source, target, endpoints, timeoutMs, fetchImpl }): returns first success or { ok:false }.
    Exposes DEFAULT_ENDPOINTS.
language-mapper.js: 
    Maps BCP-47/aliases to provider codes.
    mapToProviderLang(input): returns auto or base/alias.
tests/translator.test.js: 
    Node-based test of success/fallback/invalid args using a mock fetch.
tests/language-mapper.test.js: 
    Node-based test verifying mapping logic and edge cases.
