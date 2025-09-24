const { translateViaEndpoints } = require('../translator');

function createFetch(ok = true, text = 'hola', failCount = 0) {
  let calls = 0;
  const impl = async (url, opts) => {
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

async function run() {
  // Successful first endpoint
  const fetch1 = createFetch(true, 'hello');
  const res1 = await translateViaEndpoints({ text: 'hola', source: 'es', target: 'en', endpoints: ['a','b'], fetchImpl: fetch1, timeoutMs: 2000 });
  console.assert(res1.ok && res1.translatedText === 'hello', 'res1 should succeed');

  // First fails, second succeeds
  const fetch2 = createFetch(true, 'ciao', 1);
  const res2 = await translateViaEndpoints({ text: 'hola', source: 'en', target: 'it', endpoints: ['a','b'], fetchImpl: fetch2, timeoutMs: 2000 });
  console.assert(res2.ok && res2.translatedText === 'ciao', 'res2 should fallback succeed');

  // Invalid args
  const res3 = await translateViaEndpoints({ text: '', target: 'en', fetchImpl: fetch1 });
  console.assert(!res3.ok, 'res3 should fail invalid args');

  console.log('translator.test: ok');
}

run().catch((e) => { console.error(e); process.exit(1); });


