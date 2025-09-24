// Lightweight translation helper usable in both MV3 service worker and Node tests.
// Runs multiple endpoints in parallel and returns the first successful result.

(function(rootFactory) {
  const lib = rootFactory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = lib;
  }
  if (typeof self !== 'undefined') {
    // Service worker / worker
    Object.assign(self, lib);
  }
  if (typeof window !== 'undefined') {
    Object.assign(window, lib);
  }
})(function() {
  const DEFAULT_ENDPOINTS = [
    'https://libretranslate.de/translate',
    'https://translate.argosopentech.com/translate'
  ];

  function withTimeout(promise, timeoutMs, onTimeoutAbort) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        try { onTimeoutAbort && onTimeoutAbort(); } catch {}
        reject(new Error('timeout'));
      }, timeoutMs);
      promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
    });
  }

  async function translateViaEndpoints(opts) {
    const {
      text,
      source,
      target,
      endpoints = DEFAULT_ENDPOINTS,
      timeoutMs = 5000,
      fetchImpl = (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null)
    } = opts || {};

    if (!fetchImpl) {
      return { ok: false, error: 'fetch_unavailable' };
    }
    if (!text || !target) {
      return { ok: false, error: 'invalid_args' };
    }

    const attempt = (url) => {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const startedAt = Date.now();
      const p = (async () => {
        const res = await fetchImpl(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ q: text, source: source || 'auto', target, format: 'text' }),
          signal: controller ? controller.signal : undefined
        });
        if (!res.ok) throw new Error(`bad_status_${res.status}`);
        const data = await res.json();
        if (!data || !data.translatedText) throw new Error('no_translatedText');
        const ms = Date.now() - startedAt;
        return { ok: true, translatedText: data.translatedText, endpoint: url, ms };
      })();
      return withTimeout(p, timeoutMs, () => controller && controller.abort());
    };

    const racers = endpoints.map((u) => attempt(u));
    try {
      // Prefer first fulfillment
      const result = await Promise.any(racers);
      return result;
    } catch (e) {
      // Collect last error semantics but return a standard shape
      return { ok: false, error: 'all_failed' };
    }
  }

  return { translateViaEndpoints, DEFAULT_ENDPOINTS };
});


