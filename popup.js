// Popup script: injects content.js into the active tab, lets users
// start/stop recognition, and choose input/output languages. Persists
// settings via chrome.storage.sync and broadcasts changes to the tab.
const startBtn = document.getElementById('start');
const textList = document.getElementById('text-list');
const inputSel = document.getElementById('inputLang');
const outputSel = document.getElementById('outputLang');
const endpointsTextarea = document.getElementById('endpoints');
const saveEndpointsBtn = document.getElementById('saveEndpoints');
const testEndpointBtn = document.getElementById('testEndpoint');
const endpointStatus = document.getElementById('endpointStatus');

let isListening = false;

async function ensureContentScript() {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs && tabs[0] && tabs[0].id;
        if (!tabId) return resolve(false);
        chrome.scripting.executeScript(
          { target: { tabId }, files: ['content.js'] },
          (results) => {
            if (chrome.runtime.lastError) return resolve(false);
            resolve(!!results);
          }
        );
      });
    } catch (e) {
      resolve(false);
    }
  });
}

async function sendControl(type) {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs && tabs[0] && tabs[0].id;
      if (!tabId) return resolve(false);
      chrome.tabs.sendMessage(tabId, { __audioTranslatorMsg: true, type }, () => {
        if (chrome.runtime.lastError) return resolve(false);
        resolve(true);
      });
    });
  });
}

async function toggleListening() {
  startBtn.disabled = true;
  startBtn.classList.add('is-busy');
  const injected = await ensureContentScript();
  if (!injected) {
    startBtn.disabled = false;
    startBtn.classList.remove('is-busy');
    alert('Cannot run on this page. Open a regular website tab (https://…) and try again.');
    return;
  }
  if (!isListening) {
    const ok = await sendControl('START');
    if (!ok) {
      startBtn.disabled = false;
      startBtn.classList.remove('is-busy');
      alert('Could not start on this page. Try another tab.');
      return;
    }
    isListening = true;
    startBtn.textContent = 'Stop Listening';
    startBtn.classList.add('is-listening');
  } else {
    await sendControl('STOP');
    isListening = false;
    startBtn.textContent = 'Start Listening';
    startBtn.classList.remove('is-listening');
  }
  startBtn.disabled = false;
  startBtn.classList.remove('is-busy');
}

startBtn.addEventListener('click', toggleListening);

// Languages
const LANGS = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'vi', name: 'Vietnamese' }
];

function fillSelect(sel, selected) {
  sel.innerHTML = '';
  LANGS.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.code;
    opt.textContent = l.name;
    if (l.code === selected) opt.selected = true;
    sel.appendChild(opt);
  });
}

function getPrefs(defaults) {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(defaults, (cfg) => resolve(cfg || defaults));
      } else {
        const raw = localStorage.getItem('audioTranslatorPrefs');
        if (!raw) return resolve(defaults);
        try { resolve({ ...defaults, ...JSON.parse(raw) }); } catch { resolve(defaults); }
      }
    } catch {
      console.log('getPrefs error');
      resolve(defaults);
    }
  });
}

function setPrefs(prefs) {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set(prefs);
    } else {
      localStorage.setItem('audioTranslatorPrefs', JSON.stringify(prefs));
    }
  } catch {
    console.log('setPrefs error');
  }
}

async function loadPrefs() {
  const defaults = { inputLang: 'en', outputLang: 'es', endpoints: [] };
  const cfg = await getPrefs(defaults);
  fillSelect(inputSel, cfg.inputLang);
  fillSelect(outputSel, cfg.outputLang);
  endpointsTextarea.value = (cfg.endpoints || []).join('\n');
  setEndpoints(cfg.endpoints || []);
  const injected = await ensureContentScript();
  if (injected) broadcastConfig(cfg.inputLang, cfg.outputLang);
}

function savePrefs() {
  const inputLang = inputSel.value;
  const outputLang = outputSel.value;
  const endpoints = endpointsTextarea.value.split(/\n+/).map(s => s.trim()).filter(Boolean);
  setPrefs({ inputLang, outputLang, endpoints });
  setEndpoints(endpoints);
  broadcastConfig(inputLang, outputLang);
}

function setEndpoints(endpoints) {
  try {
    chrome.runtime.sendMessage({ __audioTranslatorEndpoints: true, endpoints }, () => {});
  } catch {}
}

function showEndpointStatus(text, success) {
  if (!endpointStatus) return;
  endpointStatus.textContent = text;
  endpointStatus.style.color = success ? '#15803d' : '#b91c1c';
}

async function testEndpoint(url) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: 'ping', source: 'en', target: 'es', format: 'text' })
    });
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }
    const data = await response.json().catch(() => null);
    if (data && (data.translatedText || (data.data && data.data.translations))) {
      return { ok: true, endpoint: url };
    }
    return { ok: false, error: 'Unexpected response format.' };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : 'Request failed.' };
  }
}

function broadcastConfig(inputLang, outputLang) {
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs && tabs[0] && tabs[0].id;
      if (!tabId) return;
      chrome.tabs.sendMessage(tabId, { __audioTranslatorMsg: true, type: 'CONFIG', inputLang, outputLang }, () => {
        // ignore connection errors silently here
      });
    });
  } catch { 
    console.log('broadcastConfig error');
  }
}

inputSel.addEventListener('change', savePrefs);
outputSel.addEventListener('change', savePrefs);
saveEndpointsBtn.addEventListener('click', () => {
  savePrefs();
  showEndpointStatus('Endpoints saved.', true);
});

testEndpointBtn.addEventListener('click', async () => {
  const endpoints = endpointsTextarea.value.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (!endpoints.length) {
    showEndpointStatus('Enter at least one endpoint to test.', false);
    return;
  }
  // Persist and inform background first
  setPrefs({ endpoints });
  setEndpoints(endpoints);
  showEndpointStatus('Testing via background…', true);
  try {
    const startedAt = Date.now();
    chrome.runtime.sendMessage(
      { __audioTranslatorBg: true, text: 'ping', source: 'en', target: 'es' },
      (resp) => {
        const ms = Date.now() - startedAt;
        if (resp && resp.ok) {
          showEndpointStatus(`Success (${ms} ms)`, true);
        } else {
          showEndpointStatus(`Failed: ${(resp && resp.error) || 'unknown error'}`, false);
        }
      }
    );
  } catch (e) {
    showEndpointStatus('Failed to reach endpoint.', false);
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  await ensureContentScript();
  loadPrefs();
});
