(function() {
  if (window.__audioTranslatorPageInjected) return;
  window.__audioTranslatorPageInjected = true;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Web Speech API not supported in this page context.');
    return;
  }

  let recognition = null;
  let isListening = false;
  let currentInputLang = 'en';
  let currentOutputLang = 'es';

  function ensureRecognition() {
    if (!recognition) {
      recognition = new SpeechRecognition();
      // Map to BCP-47 tags where possible
      const langMap = { zh: 'zh-CN', pt: 'pt-PT', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', ru: 'ru-RU', ar: 'ar-SA', ja: 'ja-JP', ko: 'ko-KR' };
      recognition.lang = langMap[currentInputLang] || currentInputLang;
      recognition.interimResults = false;
      recognition.continuous = true;

      recognition.onstart = () => console.debug('[AudioTranslator] Listening…');
      recognition.onerror = (e) => console.debug('[AudioTranslator] Error', e);
      recognition.onend = () => {
        if (isListening) {
          try { recognition.start(); } catch {}
        }
      };

      recognition.onresult = async (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (!event.results[i].isFinal) continue;
          const transcript = event.results[i][0].transcript.trim();
          if (!transcript) continue;
          window.postMessage({ __audioTranslatorToast: true, text: `(${currentInputLang}) : ${transcript}`, translated: false }, '*');
          try {
            const res = await translateText(transcript, currentInputLang, currentOutputLang);
            const translated = typeof res === 'string' ? res : (res && res.text) || '[Translation Failed]';
            window.postMessage({ __audioTranslatorToast: true, text: `(${currentOutputLang}) : ${translated}`, translated: true }, '*');
          } catch (err) {
            window.postMessage({ __audioTranslatorToast: true, text: 'Translation failed', translated: true }, '*');
          }
        }
      };
    }
    return recognition;
  }

  async function translateText(text, sourceLang = 'en', targetLang = 'es') {
    return new Promise((resolve) => {
      try {
        window.postMessage({ __audioTranslatorTranslate: true, text, source: sourceLang, target: targetLang }, '*');
        const handler = (e) => {
          const d = e.data;
          if (!d || d.__audioTranslatorTranslateResult !== true) return;
          window.removeEventListener('message', handler);
          if (d.ok) return resolve({ text: d.text, ms: d.ms || 0 });
          resolve({ text: '[Translation Failed]', ms: d.ms || 0 });
        };
        window.addEventListener('message', handler);
      } catch (e) {
        resolve({ text: '[Translation Failed]', ms: 0 });
      }
    });
  }

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg || msg.__audioTranslatorMsg !== true) return;
    if (msg.type === 'START') {
      ensureRecognition();
      if (!isListening) {
        isListening = true;
        try { recognition.start(); } catch {}
      }
    } else if (msg.type === 'STOP') {
      isListening = false;
      try { recognition && recognition.stop(); } catch {}
    } else if (msg.type === 'CONFIG') {
      if (typeof msg.inputLang === 'string') currentInputLang = msg.inputLang;
      if (typeof msg.outputLang === 'string') currentOutputLang = msg.outputLang;
      window.postMessage({ __audioTranslatorToast: true, text: `Lang: ${currentInputLang} → ${currentOutputLang}` }, '*');
      try {
        if (recognition) {
          const langMap = { zh: 'zh-CN', pt: 'pt-PT', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', ru: 'ru-RU', ar: 'ar-SA', ja: 'ja-JP', ko: 'ko-KR' };
          recognition.lang = langMap[currentInputLang] || currentInputLang;
        }
      } catch {}
    }
  });
})();
