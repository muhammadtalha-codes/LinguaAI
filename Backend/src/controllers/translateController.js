const grokService = require('../services/grokService');
const { isValidLanguage, SUPPORTED_LANGUAGES } = require('../config/languages');

// 🌐 TRANSLATE
async function handleTranslate(req, res, next) {
  try {
    const { text, sourceLang, targetLang, tone } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide text to translate.',
      });
    }

    if (text.trim().length > 5000) {
      return res.status(400).json({
        success: false,
        error: 'Text exceeds the 5,000-character limit.',
      });
    }

    if (!sourceLang || !isValidLanguage(sourceLang)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or unsupported source language.',
      });
    }

    if (!targetLang || !isValidLanguage(targetLang)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or unsupported target language.',
      });
    }

    if (sourceLang === targetLang) {
      return res.status(400).json({
        success: false,
        error: 'Source and target languages must be different.',
      });
    }

    const validTones = ['neutral', 'formal', 'casual', 'romantic', 'genz'];
    const selectedTone = validTones.includes(tone) ? tone : 'neutral';

    const startTime = Date.now();
    const translatedText = await grokService.translate(
      text.trim(),
      sourceLang,
      targetLang,
      selectedTone
    );
    const duration = Date.now() - startTime;

    const charCount = translatedText.length;
    const wordCount = translatedText.split(/\s+/).filter(Boolean).length;
    const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

// 🔤 Optional romanization (never breaks translation if it fails)
let romanization = '';
try {
  if (
    grokService.needsRomanization &&
    grokService.needsRomanization(targetLang) &&
    grokService.romanize
  ) {
    romanization = await grokService.romanize(translatedText, targetLang);
  }
} catch (romanizeError) {
  console.warn('Romanization skipped:', romanizeError.message);
  romanization = '';
}

return res.json({
  success: true,
  data: {
    translatedText,
    romanization, // '' when not needed/failed
    meta: {
      charCount,
      wordCount,
      readingTime: `${readingTimeMinutes} min read`,
      translationTime: `${(duration / 1000).toFixed(2)}s`,
      sourceLang,
      targetLang,
      tone: selectedTone,
    },
  },
});
} catch (error) {
    next(error);
  }
}

// 🌐 LANGUAGES LIST
function getLanguages(req, res) {
  const languages = Object.values(SUPPORTED_LANGUAGES).map(
    ({ code, name, nativeName, direction }) => ({ code, name, nativeName, direction })
  );

  res.json({ success: true, data: languages });
}

// 🔊 TTS AUDIO PROXY (With Pashto & Fallback Support)
async function handleTTS(req, res) {
  try {
    const { text, lang } = req.query;

    if (!text || !lang) {
      return res.status(400).json({ success: false, error: 'Missing text or lang parameter' });
    }

    const cleanText = String(text).trim().substring(0, 300);
    const rawLang = String(lang).trim().toLowerCase();

    // Map languages without native TTS voice codes to phonetic equivalent engines
    const ttsLangFallback = {
      ps: 'ur', // Pashto script is pronounced cleanly via Pashto-compatible audio engine
    };

    const targetLang = ttsLangFallback[rawLang] || rawLang;

    const ttsUrl =
      `https://translate.google.com/translate_tts?ie=UTF-8` +
      `&q=${encodeURIComponent(cleanText)}` +
      `&tl=${encodeURIComponent(targetLang)}` +
      `&client=tw-ob`;

    let response = await fetch(ttsUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    // Fallback if primary fails
    if (!response.ok && targetLang !== 'ur') {
      const fallbackUrl =
        `https://translate.google.com/translate_tts?ie=UTF-8` +
        `&q=${encodeURIComponent(cleanText)}` +
        `&tl=ur` +
        `&client=tw-ob`;

      response = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
    }

    if (!response.ok) {
      return res.status(500).json({ success: false, error: 'Failed to fetch audio stream' });
    }

    const arrayBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('TTS Service Error:', error);
    return res.status(500).json({ success: false, error: 'Audio Proxy Failed' });
  }
}

// ✨ EXPLAIN (AI TUTOR)
async function handleExplain(req, res, next) {
  try {
    const { text, translatedText, sourceLang, targetLang } = req.body;

    if (!text || !translatedText) {
      return res.status(400).json({
        success: false,
        error: 'Missing text or translatedText data.',
      });
    }

    const explanation = await grokService.explainTranslation(
      text,
      translatedText,
      sourceLang || 'en',
      targetLang || 'ur'
    );

    return res.json({
      success: true,
      data: { explanation },
    });
  } catch (error) {
    console.error('Explain Error:', error);
    next(error);
  }
}

module.exports = {
  handleTranslate,
  getLanguages,
  handleTTS,
  handleExplain,
};