const SUPPORTED_LANGUAGES = {
  en: { code: 'en', name: 'English',  nativeName: 'English',  direction: 'ltr' },
  ur: { code: 'ur', name: 'Urdu',     nativeName: 'اردو',     direction: 'rtl' },
  ps: { code: 'ps', name: 'Pashto',   nativeName: 'پښتو',      direction: 'rtl' },
  ar: { code: 'ar', name: 'Arabic',   nativeName: 'العربية',   direction: 'rtl' },
  fr: { code: 'fr', name: 'French',   nativeName: 'Français', direction: 'ltr' },
  de: { code: 'de', name: 'German',   nativeName: 'Deutsch',  direction: 'ltr' },
  es: { code: 'es', name: 'Spanish',  nativeName: 'Español',  direction: 'ltr' },
  hi: { code: 'hi', name: 'Hindi',    nativeName: 'हिन्दी',     direction: 'ltr' },
  zh: { code: 'zh', name: 'Chinese',  nativeName: '中文',      direction: 'ltr' },
  ja: { code: 'ja', name: 'Japanese', nativeName: '日本語',    direction: 'ltr' },
};

function isValidLanguage(code) {
  return code in SUPPORTED_LANGUAGES;
}

function getLanguageName(code) {
  return SUPPORTED_LANGUAGES[code]?.name || code;
}

module.exports = {
  SUPPORTED_LANGUAGES,
  isValidLanguage,
  getLanguageName,
};