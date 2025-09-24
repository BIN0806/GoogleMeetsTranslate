// Background translation relay with shared helper, language mapping, and DEBUG logs
try { importScripts('translator.js'); } catch {}
try { importScripts('language-mapper.js'); } catch {}

let DEBUG = false;
try {
  chrome.storage && chrome.storage.sync && chrome.storage.sync.get({ DEBUG: false }, (cfg) => {
    DEBUG = !!(cfg && cfg.DEBUG);
  });
} catch {}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

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
        const result = await translateViaEndpoints({ text, source: mappedSource, target: mappedTarget });
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
