// Content script: builds overlay UI, handles SpeechRecognition when available,
// and relays translation requests to the background. If SpeechRecognition is
// not available in the content world (e.g. cross‑origin iframes), injects
// a page‑context script (page.js) to handle recognition and bridges messages.
(function() {
  if (window.__audioTranslatorInjected) return;
  window.__audioTranslatorInjected = true;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const usePageScript = !SpeechRecognition;
  if (usePageScript) {
    // Bridge messages from extension to page, then inject page script to run in main world
    try {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.__audioTranslatorMsg === true) {
          window.postMessage(msg, '*');
        }
      });
    } catch {}
    try {
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL('page.js');
      s.onload = () => s.remove();
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {
      console.warn('Failed to inject page script', e);
    }
  }

  // Overlay container
  const container = document.createElement('div');
  container.id = 'audio-translator-overlay';
  container.style.position = 'fixed';
  container.style.right = '16px';
  container.style.bottom = '16px';
  container.style.width = '320px';
  container.style.minHeight = '48px';
  container.style.background = 'rgba(20,20,20,0.9)';
  container.style.color = '#fff';
  container.style.borderRadius = '8px';
  container.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
  container.style.zIndex = '2147483647';
  container.style.userSelect = 'none';
  container.style.backdropFilter = 'blur(6px)';
  container.style.overflow = 'hidden';

  // Header
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.gap = '8px';
  header.style.padding = '8px 12px';
  header.style.background = 'rgba(255,255,255,0.06)';
  header.style.fontSize = '12px';
  header.textContent = 'Audio Translator';
  container.appendChild(header);

  // Body (messages)
  const body = document.createElement('div');
  body.style.position = 'relative';
  body.style.padding = '8px 12px 12px 12px';
  body.style.minHeight = '24px';
  body.style.display = 'flex';
  body.style.flexDirection = 'column';
  body.style.alignItems = 'flex-end';
  body.style.gap = '6px';
  container.appendChild(body);

  // Debug HUD
  let DEBUG = false;
  let hudVisible = false;
  const hud = document.createElement('div');
  hud.style.position = 'absolute';
  hud.style.left = '8px';
  hud.style.bottom = '8px';
  hud.style.padding = '6px 8px';
  hud.style.border = '1px solid rgba(255,255,255,0.2)';
  hud.style.borderRadius = '6px';
  hud.style.background = 'rgba(0,0,0,0.35)';
  hud.style.font = '11px/1.4 monospace';
  hud.style.whiteSpace = 'pre';
  hud.style.display = 'none';
  container.appendChild(hud);

  const stats = {
    mode: usePageScript ? 'page' : 'content',
    input: 'en',
    output: 'es',
    translations: 0,
    lastMs: 0,
    avgMs: 0
  };

  function setDebug(enabled) {
    DEBUG = !!enabled;
    try {
      chrome.runtime.sendMessage({ __audioTranslatorDebug: true, enabled: DEBUG }, () => {});
    } catch {}
    renderHUD();
  }

  function toggleHUD() {
    hudVisible = !hudVisible;
    hud.style.display = hudVisible ? 'block' : 'none';
    renderHUD();
  }

  function renderHUD() {
    if (!hudVisible) return;
    hud.textContent = `DEBUG: ${DEBUG ? 'on' : 'off'}\n` +
      `mode: ${stats.mode}\n` +
      `lang: ${stats.input} → ${stats.output}\n` +
      `translations: ${stats.translations}\n` +
      `last: ${stats.lastMs} ms  avg: ${stats.avgMs.toFixed(0)} ms`;
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'd' || e.key === 'D')) {
      toggleHUD();
      e.preventDefault();
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'b' || e.key === 'B')) {
      setDebug(!DEBUG);
      e.preventDefault();
    }
  });

  // Bridge page toasts back into overlay
  window.addEventListener('message', (e) => {
    const data = e.data;
    if (!data || data.__audioTranslatorToast !== true) return;
    showToast(data.text);
  });

  // Bridge translation requests from page to background and back
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.__audioTranslatorTranslate !== true) return;
    translateText(d.text, d.source, d.target).then((t) => {
      window.postMessage({ __audioTranslatorTranslateResult: true, ok: t && t !== '[Translation Failed]', text: t }, '*');
    });
  });

  // Resizer
  const resizer = document.createElement('div');
  resizer.style.position = 'absolute';
  resizer.style.width = '12px';
  resizer.style.height = '12px';
  resizer.style.right = '4px';
  resizer.style.bottom = '4px';
  resizer.style.cursor = 'nwse-resize';
  resizer.style.background = 'transparent';
  resizer.style.borderRight = '2px solid rgba(255,255,255,0.4)';
  resizer.style.borderBottom = '2px solid rgba(255,255,255,0.4)';
  container.appendChild(resizer);

  document.documentElement.appendChild(container);

  // Toast helper
  function showToast(text) {
    const toast = document.createElement('div');
    toast.textContent = text;
    toast.style.alignSelf = 'flex-end';
    toast.style.maxWidth = '100%';
    toast.style.padding = '6px 10px';
    toast.style.background = 'rgba(255,255,255,0.1)';
    toast.style.border = '1px solid rgba(255,255,255,0.15)';
    toast.style.borderRadius = '6px';
    toast.style.fontSize = '12px';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'opacity 160ms ease, transform 160ms ease';
    toast.style.wordBreak = 'break-word';
    body.appendChild(toast);

    // Limit number of visible toasts to avoid overflow
    const maxToasts = 6;
    while (body.children.length > maxToasts) {
      body.removeChild(body.firstChild);
    }

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      setTimeout(() => toast.remove(), 220);
    }, 3000);
  }

  // Dragging
  (function enableDrag(el, handle) {
    let offsetX = 0, offsetY = 0, dragging = false;
    function onDown(e) {
      if (e.target === resizer) return; // don't start drag on resizer
      dragging = true;
      offsetX = e.clientX - el.getBoundingClientRect().left;
      offsetY = e.clientY - el.getBoundingClientRect().top;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.preventDefault();
    }
    handle.addEventListener('mousedown', onDown);
    // Also allow dragging by grabbing anywhere on the box
    if (handle !== el) el.addEventListener('mousedown', onDown);
    function onMove(e) {
      if (!dragging) return;
      el.style.left = `${e.clientX - offsetX}px`;
      el.style.top = `${e.clientY - offsetY}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    }
    function onUp() {
      dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
  })(container, header);

  // Resizing
  (function enableResize(el, handle) {
    let startX = 0, startY = 0, startW = 0, startH = 0, resizing = false;
    handle.addEventListener('mousedown', (e) => {
      resizing = true;
      const r = el.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      startW = r.width; startH = r.height;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.preventDefault();
    });
    function onMove(e) {
      if (!resizing) return;
      const newW = Math.max(240, startW + (e.clientX - startX));
      const newH = Math.max(48, startH + (e.clientY - startY));
      el.style.width = `${newW}px`;
      el.style.height = `${newH}px`;
    }
    function onUp() {
      resizing = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
  })(container, resizer);

  // Recognition lifecycle (content world), used only if SpeechRecognition exists here
  let recognition = null;
  let isListening = false;
  function ensureRecognition() {
    if (usePageScript) return null;
    if (!recognition && SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.continuous = true;

      recognition.onstart = () => showToast('Listening…');
      recognition.onerror = (e) => showToast(`Error: ${e.error || 'unknown'}`);
      recognition.onend = () => {
        if (isListening) {
          try { recognition.start(); } catch {}
        } else {
          showToast('Stopped');
        }
      };

      recognition.onresult = async (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (!event.results[i].isFinal) continue;
          const transcript = event.results[i][0].transcript.trim();
          if (!transcript) continue;
          showToast(`(${currentInputLang}) : ${transcript}`);
          try {
            const tr = await translateText(transcript, currentInputLang, currentOutputLang);
            const translated = typeof tr === 'string' ? tr : (tr && tr.text) || '[Translation Failed]';
            showToast(`(${currentOutputLang}) : ${translated}`);
          } catch (err) {
            showToast('Toast: Translation failed');
          }
        }
      };
    }
    return recognition;
  }

  let currentInputLang = 'en';
  let currentOutputLang = 'es';

  async function translateText(text, sourceLang = currentInputLang, targetLang = currentOutputLang) {
    return new Promise((resolve) => {
      try {
        const startedAt = Date.now();
        chrome.runtime.sendMessage(
          { __audioTranslatorBg: true, text, source: sourceLang, target: targetLang },
          (resp) => {
            const latency = (resp && typeof resp.ms === 'number') ? resp.ms : (Date.now() - startedAt);
            stats.translations += 1;
            stats.lastMs = latency;
            const n = stats.translations;
            stats.avgMs = ((stats.avgMs * (n - 1)) + latency) / n;
            renderHUD();
            if (resp && resp.ok) return resolve({ text: resp.translatedText, ms: latency });
            resolve({ text: 'Translate Text:[Translation Failed]', ms: latency });
          }
        );
      } catch (e) {
        resolve({ text: 'Translate Text: [Translation Failed]', ms: 0 });
      }
    });
  }

  // Listen for start/stop from the extension (popup/background)
  function handleControlMessage(msg) {
    if (!msg || msg.__audioTranslatorMsg !== true) return false;
    const { type } = msg;
    if (usePageScript) {
      // Forward to page script; it will manage recognition and post toasts back
      window.postMessage(msg, '*');
      return true;
    } else {
      if (type === 'START') {
        ensureRecognition();
        if (!isListening) {
          isListening = true;
          try { recognition && recognition.start(); } catch {}
        }
        return true;
      }
      if (type === 'STOP') {
        isListening = false;
        try { recognition && recognition.stop(); } catch {}
        return true;
      }
      if (type === 'CONFIG') {
        if (typeof msg.inputLang === 'string') currentInputLang = msg.inputLang;
        if (typeof msg.outputLang === 'string') currentOutputLang = msg.outputLang;
        stats.input = currentInputLang;
        stats.output = currentOutputLang;
        renderHUD();
        showToast(`Lang: ${currentInputLang} => ${currentOutputLang}`);
        return true;
      }
    }
    return false;
  }

  // From popup via runtime messaging
  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      const handled = handleControlMessage(msg);
      if (handled) sendResponse({ ok: true });
      // return true not required here; no async response
    });
  } catch {}

  // Also support window messages from page if ever used
  window.addEventListener('message', (e) => {
    const data = e.data;
    if (handleControlMessage(data)) return;
    if (data && data.__audioTranslatorTranslate === true) {
      translateText(data.text, data.source, data.target).then((res) => {
        const out = (res && res.text) || '[Translation Failed]';
        const ms = (res && res.ms) || 0;
        window.postMessage({ __audioTranslatorTranslateResult: true, ok: out && out !== '[Translation Failed]', text: out, ms }, '*');
      });
    }
  });
})();
