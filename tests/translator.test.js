const { translateViaEndpoints } = require('../js/translator');

function createFetch(ok = true, text = 'hola', failCount = 0) {
  let calls = 0;
  const impl = async (url) => {
    calls++;
    if (failCount-- > 0) {
      return { ok: false, status: 503, json: async () => ({}) };
    }
    return {
      ok,
      status: ok ? 200 : 500,
      json: async () => ({ translatedText: text })
    };
  };
  impl.calls = () => calls;
  return impl;
}

describe('translateViaEndpoints', () => {
  test('succeeds on first endpoint', async () => {
    const fetch1 = createFetch(true, 'hello');
    const res = await translateViaEndpoints({ text: 'hola', source: 'es', target: 'en', endpoints: ['a','b'], fetchImpl: fetch1, timeoutMs: 2000 });
    expect(res.ok).toBe(true);
    expect(res.translatedText).toBe('hello');
  });

  test('falls back when first endpoint fails', async () => {
    const fetch2 = createFetch(true, 'ciao', 1);
    const res = await translateViaEndpoints({ text: 'hola', source: 'en', target: 'it', endpoints: ['a','b'], fetchImpl: fetch2, timeoutMs: 2000 });
    expect(res.ok).toBe(true);
    expect(res.translatedText).toBe('ciao');
  });

  test('returns error on invalid args', async () => {
    const fetch3 = createFetch(true, 'hello');
    const res = await translateViaEndpoints({ text: '', target: 'en', fetchImpl: fetch3 });
    expect(res.ok).toBe(false);
  });
});
