const { getLanguageName } = require('../config/languages');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const TONE_INSTRUCTIONS = {
  neutral: 'Translate in a clear, natural, standard tone. Balanced and universal.',
  formal: 'Translate in a highly formal, professional, and respectful tone. Use polished vocabulary.',
  casual: 'Translate in a friendly, casual, conversational tone as if chatting with a close friend.',
  romantic: 'Translate in a warm, poetic, and romantic tone. Use heartfelt, expressive vocabulary.',
  genz: 'Translate in a trendy Gen-Z tone using modern slang and casual expressions.',
};

function buildSystemPrompt(tone = 'neutral') {
  const toneInstruction = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.neutral;

  return `You are an expert multilingual translator with mastery of tone, style, and cultural nuance.

TONE STYLE FOR THIS TRANSLATION:
${toneInstruction}

Rules you MUST follow:
1. Return ONLY the translated text — nothing else.
2. Preserve the original meaning and intent.
3. Apply the requested tone naturally within the target language's culture.
4. Keep proper nouns, names, brands, and technical terms unchanged unless localized.
5. Maintain original formatting.
6. Never add explanations, notes, disclaimers, or commentary.
7. If the input is already in the target language, rephrase it in the requested tone.
8. Handle idiomatic expressions by translating their meaning in the requested tone.`;
}

function buildUserPrompt(text, sourceLang, targetLang) {
  const sourceName = getLanguageName(sourceLang);
  const targetName = getLanguageName(targetLang);
  return `Translate the following text from ${sourceName} to ${targetName}.\n\nText:\n${text}`;
}

// 🌐 TRANSLATE FUNCTION
async function translate(text, sourceLang, targetLang, tone = 'neutral') {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured on the server.');
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt(tone) },
        { role: 'user', content: buildUserPrompt(text, sourceLang, targetLang) },
      ],
      temperature: tone === 'romantic' || tone === 'genz' ? 0.7 : 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Groq API translate error:', response.status, errorBody);
    throw new Error(`Translation service returned status ${response.status}`);
  }

  const data = await response.json();
  const translatedText = data.choices?.[0]?.message?.content?.trim();

  if (!translatedText) {
    throw new Error('No translation was returned by the AI service.');
  }

  return translatedText;
}

// ✨ EXPLAIN FUNCTION
function buildExplainPrompt(text, translatedText, sourceLang, targetLang) {
  const sourceName = getLanguageName(sourceLang);
  const targetName = getLanguageName(targetLang);

  return `You are a friendly, expert language tutor.
Analyze this translation from ${sourceName} to ${targetName}.

Original Text: "${text}"
Translation: "${translatedText}"

Provide a brief, beautiful breakdown using this exact format:

📝 **Word-by-Word Breakdown**:
(Break down 2-3 key words here)

🧠 **Grammar Note**:
(Explain 1 key grammar rule used in this sentence)

💡 **Cultural Note / Nuance**:
(Explain any cultural nuance or write "Standard natural phrasing")

🔄 **Alternative Expressions**:
1. (Formal version)
2. (Casual version)

Keep it engaging, concise, clean, and easy to read.`;
}

async function explainTranslation(text, translatedText, sourceLang, targetLang) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured on the server.');
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: 'You are an expert multilingual language tutor.' },
        { role: 'user', content: buildExplainPrompt(text, translatedText, sourceLang, targetLang) },
      ],
      temperature: 0.5,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Groq API explain error:', response.status, errorBody);
    throw new Error(`Explain service returned status ${response.status}`);
  }

  const data = await response.json();
  const explanation = data.choices?.[0]?.message?.content?.trim();

  if (!explanation) {
    throw new Error('No explanation returned from AI.');
  }

  return explanation;
}


// ══════════════════════════════════════════════
// 🔤 ROMANIZATION (Pronunciation Guide)
// ══════════════════════════════════════════════
const ROMANIZE_LANGS = new Set(['ur', 'ps', 'ar', 'hi', 'zh', 'ja']);

function needsRomanization(langCode) {
  return ROMANIZE_LANGS.has(langCode);
}

async function romanize(text, langCode) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured on the server.');
  }

  if (!text || !needsRomanization(langCode)) {
    return '';
  }

  const langName = getLanguageName(langCode);

  const prompt = `Convert the following ${langName} text into easy Latin-script pronunciation (romanization) for English speakers.

Rules:
1. Return ONLY the romanized pronunciation.
2. No quotes, no labels, no explanations.
3. Keep it natural and easy to read aloud.
4. For Urdu/Pashto/Arabic/Hindi use common phonetic spelling (e.g. "Mera naam").
5. For Chinese use Pinyin.
6. For Japanese use Hepburn romaji.

Text:
${text}`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: 'You convert text into clear Latin-script pronunciation only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Groq romanize error:', response.status, errorBody);
    throw new Error(`Romanization service returned status ${response.status}`);
  }

  const data = await response.json();
  const romanized = data.choices?.[0]?.message?.content?.trim() || '';

  // Clean accidental quotes/labels
  return romanized
    .replace(/^["']|["']$/g, '')
    .replace(/^(romanization|pronunciation)\s*[:\-]\s*/i, '')
    .trim();
}

module.exports = {
  translate,
  explainTranslation,
  romanize,
  needsRomanization,
};