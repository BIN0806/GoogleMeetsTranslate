const startBtn = document.getElementById('start');
const textList = document.getElementById('text-list');
const inputSel = document.getElementById('inputLang');
const outputSel = document.getElementById('outputLang');

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
  { code: 'ko', name: 'Korean' }
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
  const defaults = { inputLang: 'en', outputLang: 'es' };
  const cfg = await getPrefs(defaults);
  fillSelect(inputSel, cfg.inputLang);
  fillSelect(outputSel, cfg.outputLang);
  const injected = await ensureContentScript();
  if (injected) broadcastConfig(cfg.inputLang, cfg.outputLang);
}

function savePrefs() {
  const inputLang = inputSel.value;
  const outputLang = outputSel.value;
  setPrefs({ inputLang, outputLang });
  broadcastConfig(inputLang, outputLang);
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

document.addEventListener('DOMContentLoaded', async () => {
  await ensureContentScript();
  loadPrefs();
});
