// Maps various language codes (BCP-47 or aliases) to provider codes expected by LibreTranslate-like APIs.
// Returns 'auto' unchanged to allow server-side detection.

(function(factory){
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof self !== 'undefined') Object.assign(self, api);
  if (typeof window !== 'undefined') Object.assign(window, api);
})(function(){
  const ALIASES = {
    // English
    'en': 'en', 'en-US': 'en', 'en-GB': 'en', 'en_AU': 'en',
    // Spanish
    'es': 'es', 'es-ES': 'es', 'es-MX': 'es', 'es_LA': 'es',
    // Portuguese
    'pt': 'pt', 'pt-BR': 'pt', 'pt-PT': 'pt',
    // Chinese
    'zh': 'zh', 'zh-CN': 'zh', 'zh-TW': 'zh',
    // French
    'fr': 'fr', 'fr-FR': 'fr', 'fr-CA': 'fr',
    // German
    'de': 'de', 'de-DE': 'de',
    // Italian
    'it': 'it', 'it-IT': 'it',
    // Russian
    'ru': 'ru', 'ru-RU': 'ru',
    // Arabic
    'ar': 'ar', 'ar-SA': 'ar',
    // Japanese
    'ja': 'ja', 'ja-JP': 'ja',
    // Korean
    'ko': 'ko', 'ko-KR': 'ko',
    // Vietnamese
    'vi': 'vi', 'vi-VN': 'vi'
  };

  function mapToProviderLang(input) {
    if (!input) return 'auto';
    const val = String(input).trim();
    if (!val || val.toLowerCase() === 'auto') return 'auto';
    return ALIASES[val] || (val.split('-')[0] || 'auto');
  }

  return { mapToProviderLang };
});


