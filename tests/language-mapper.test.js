const { mapToProviderLang } = require('../language-mapper');

function expectEqual(a, b, msg) {
  if (a !== b) throw new Error(`Assertion failed: ${msg} (${a} !== ${b})`);
}

function run() {
  expectEqual(mapToProviderLang('en-US'), 'en', 'en-US → en');
  expectEqual(mapToProviderLang('es'), 'es', 'es → es');
  expectEqual(mapToProviderLang('pt-BR'), 'pt', 'pt-BR → pt');
  expectEqual(mapToProviderLang('auto'), 'auto', 'auto stays auto');
  expectEqual(mapToProviderLang('ja-JP'), 'ja', 'ja-JP → ja');
  expectEqual(mapToProviderLang('fr-CA'), 'fr', 'fr-CA → fr');
  expectEqual(mapToProviderLang('xx-YY'), 'xx', 'unknown → base');
  console.log('language-mapper.test: ok');
}

run();


