// Background translation relay with shared helper, language mapping, and DEBUG logs
try { importScripts('translator.js'); } catch {}
try { importScripts('language-mapper.js'); } catch {}

let DEBUG = false;
let customEndpoints = [];
try {
  chrome.storage && chrome.storage.sync && chrome.storage.sync.get({ DEBUG: false }, (cfg) => {
    DEBUG = !!(cfg && cfg.DEBUG);
  });
  chrome.storage && chrome.storage.sync && chrome.storage.sync.get({ endpoints: [] }, (cfg) => {
    customEndpoints = Array.isArray(cfg?.endpoints) ? cfg.endpoints : [];
  });
} catch {}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  if (msg.__audioTranslatorEndpoints === true && Array.isArray(msg.endpoints)) {
    customEndpoints = msg.endpoints;
    try { chrome.storage && chrome.storage.sync && chrome.storage.sync.set({ endpoints: customEndpoints }); } catch {}
    sendResponse && sendResponse({ ok: true, endpoints: customEndpoints });
    return true;
  }

  // Toggle debug from content HUD
  if (msg.__audioTranslatorDebug === true && typeof msg.enabled === 'boolean') {
    DEBUG = !!msg.enabled;

    try { chrome.storage && chrome.storage.sync && chrome.storage.sync.set({ DEBUG }); } catch {}
    sendResponse && sendResponse({ ok: true, DEBUG });
    return true;
  }

  if (msg.__audioTranslatorBg === true) {
    const { text, source, target } = msg;
    const mappedSource = (typeof mapToProviderLang === 'function') ? mapToProviderLang(source || 'auto') : (source || 'auto');
    const mappedTarget = (typeof mapToProviderLang === 'function') ? mapToProviderLang(target) : target;
    const startedAt = Date.now();
    (async () => {
      try {
        const endpoints = customEndpoints && customEndpoints.length ? customEndpoints : undefined;
        const result = await translateViaEndpoints({ text, source: mappedSource, target: mappedTarget, endpoints });
        const latencyMs = Date.now() - startedAt;
        if (DEBUG) console.log('[BG] translate', { text, mappedSource, mappedTarget, result, latencyMs });
        if (result && result.ok) {
          sendResponse({ ok: true, translatedText: result.translatedText, endpoint: result.endpoint, ms: result.ms ?? latencyMs });
        } else {
          sendResponse({ ok: false, error: (result && result.error) || 'failed' });
        }
      } catch (e) {
        if (DEBUG) console.warn('[BG] translate error', e);
        sendResponse({ ok: false, error: e && e.message ? e.message : 'error' });
      }
    })();
    return true; // async response
  }
});
