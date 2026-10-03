/**
 * ═══════════════════════════════════════════════════
 * Translūce — COMPLETE Frontend Application
 * Features: Auto-Translate | Tone | Voice | TTS
 * Explain | Romanization | History | 📄 DOCUMENT
 * ═══════════════════════════════════════════════════
 */

(() => {
  'use strict';

  const API_BASE = 'http://192.168.1.31:3001/api';
  const DEBOUNCE_MS = 650;
  const CHUNK_SIZE = 3500; // Max characters per chunk for safe document translation

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const LANG_OPTIONS = [
    { code: 'en', label: 'English',           flag: 'us' }, // 🇺🇸
    { code: 'ur', label: 'Urdu — اردو',       flag: 'pk' }, // 🇵🇰
    { code: 'ps', label: 'Pashto — پښتو',     flag: 'af' }, // 🇦🇫
    { code: 'ar', label: 'Arabic — العربية',   flag: 'sa' }, // 🇸🇦
    { code: 'fr', label: 'French — Français', flag: 'fr' }, // 🇫🇷
    { code: 'de', label: 'German — Deutsch',  flag: 'de' }, // 🇩🇪
    { code: 'es', label: 'Spanish — Español', flag: 'es' }, // 🇪🇸
    { code: 'hi', label: 'Hindi — हिन्दी',     flag: 'in' }, // 🇮🇳
    { code: 'zh', label: 'Chinese — 中文',    flag: 'cn' }, // 🇨🇳
    { code: 'ja', label: 'Japanese — 日本語', flag: 'jp' }, // 🇯🇵
  ];

  const dom = {
    voiceOverlay:    $('#voiceOverlay'),
    voiceStatusText: $('#voiceStatusText'),
    voiceTranscript: $('#voiceTranscript'),
    voiceTimer:      $('#voiceTimer'),
    voiceCloseBtn:   $('#voiceCloseBtn'),
    voiceCancelBtn:  $('#voiceCancelBtn'),
    voiceDoneBtn:    $('#voiceDoneBtn'),
    voiceMainBtn:    $('#voiceMainBtn'),
    voiceBackdrop:   $('#voiceBackdrop'),
    themeToggle:     $('#themeToggle'),
    sourceLang:      $('#sourceLang'),
    targetLang:      $('#targetLang'),
    swapLangs:       $('#swapLangs'),
    sourceText:      $('#sourceText'),
    charCount:       $('#charCount'),
    resultArea:      $('#resultArea'),
    errorArea:       $('#errorArea'),
    translateStatus: $('#translateStatus'),
    statusText:      $('#statusText'),
    micBtn:          $('#micBtn'),
    speakSourceBtn:  $('#speakSourceBtn'),
    toneSelector:    $('#toneSelector'),
    toneSlider:      $('#toneSlider'),
    toneTabs:        $$('.tone-tab'),
    
    historyToggle:   $('#historyToggle'),
    sidebar:         $('#sidebar'),
    sidebarOverlay:  $('#sidebarOverlay'),
    closeSidebar:    $('#closeSidebar'),
    tabHistory:      $('#tabHistory'),
    tabSaved:        $('#tabSaved'),
    sidebarContent:  $('#sidebarContent'),

    // 📄 Document DOM
    uploadBtn:       $('#uploadBtn'),
    fileInput:       $('#fileInput'),
    filePreview:     $('#filePreview'),
    fileName:        $('#fileName'),
    fileSize:        $('#fileSize'),
    removeFileBtn:   $('#removeFileBtn'),
  };


  let voiceTimerInterval = null;
  let voiceSeconds = 0;
  let voiceFinalText = '';
  let recognition = null;
  let isRecording = false;
  let currentAudioPlayer = null;
  let debounceTimer = null;
  let activeRequestId = 0;
  let lastTranslatedKey = '';
  let currentTone = localStorage.getItem('transluce-tone') || 'neutral';
  let currentTranslationId = null;

  let latestContext = { originalText: '', translatedText: '', sourceLang: 'en', targetLang: 'ur' };
  let historyData = [];
  try { historyData = JSON.parse(localStorage.getItem('transluce-history')) || []; } catch(e){}
  let currentSidebarTab = 'history';

  // 📄 Active Document State
  let activeFile = null;
  let activeFileContent = '';
  let isTranslatingDocument = false;

  // ══════════════════════════════════════════════
  // THEME & TONE
  // ══════════════════════════════════════════════

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('transluce-theme', theme);
  }

  function toneEmoji(tone) { return { neutral: '⚖️', formal: '💼', casual: '💬', romantic: '💖', genz: '🔥' }[tone] || '⚖️'; }
  function toneLabel(tone) { return { neutral: 'Neutral', formal: 'Formal', casual: 'Casual', romantic: 'Romantic', genz: 'Gen-Z' }[tone] || 'Neutral'; }

  function initToneSelector() {
    if (!dom.toneTabs || !dom.toneTabs.length) return;
    let activeIndex = 0;
    dom.toneTabs.forEach((tab, i) => {
      const tone = tab.dataset.tone;
      const isActive = tone === currentTone;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) activeIndex = i;
      tab.addEventListener('click', () => selectTone(tone, i));
    });
    if (dom.toneSlider) dom.toneSlider.style.transform = `translateX(${activeIndex * 100}%)`;
  }

  function selectTone(tone, index) {
    if (tone === currentTone || isTranslatingDocument) return;
    currentTone = tone;
    localStorage.setItem('transluce-tone', tone);
    dom.toneTabs.forEach((tab) => {
      const isActive = tab.dataset.tone === tone;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    if (dom.toneSlider) dom.toneSlider.style.transform = `translateX(${index * 100}%)`;
    if (dom.toneSelector) {
      dom.toneSelector.classList.remove('is-changing');
      void dom.toneSelector.offsetWidth;
      dom.toneSelector.classList.add('is-changing');
    }
    lastTranslatedKey = '';
    scheduleTranslate(true);
  }

  // ══════════════════════════════════════════════
  // HISTORY & PHRASEBOOK
  // ══════════════════════════════════════════════

  function saveHistory() { localStorage.setItem('transluce-history', JSON.stringify(historyData)); }

  function addToHistory(original, translated, sl, tl, tone) {
    if (activeFile) return; // Don't save full documents to history
    if (historyData.length > 0) {
      const last = historyData[0];
      if (last.original === original && last.translated === translated && last.tone === tone) {
        currentTranslationId = last.id; return;
      }
    }
    currentTranslationId = Date.now().toString();
    historyData.unshift({ id: currentTranslationId, original, translated, sl, tl, tone, isFavorite: false, timestamp: new Date().toISOString() });
    if (historyData.length > 50) historyData.pop();
    saveHistory();
    if (dom.sidebar.classList.contains('is-open')) renderSidebar();
  }

  function toggleFavorite(id) {
    const entry = historyData.find(e => e.id === id);
    if (entry) {
      entry.isFavorite = !entry.isFavorite;
      saveHistory(); renderSidebar();
      if (id === currentTranslationId) {
        const starBtn = $('#starBtn');
        if (starBtn) starBtn.classList.toggle('is-starred', entry.isFavorite);
      }
    }
  }

  function renderSidebar() {
    if (!dom.sidebarContent) return;
    const items = currentSidebarTab === 'saved' ? historyData.filter(e => e.isFavorite) : historyData;
    if (items.length === 0) { dom.sidebarContent.innerHTML = `<div class="history-item__empty">No translations found.</div>`; return; }
    dom.sidebarContent.innerHTML = items.map(entry => `
      <div class="history-item">
        <div class="history-item__header">
          <span>${entry.sl.toUpperCase()} ➔ ${entry.tl.toUpperCase()} • ${toneEmoji(entry.tone)}</span>
          <button class="history-item__star ${entry.isFavorite ? 'is-starred' : ''}" data-id="${entry.id}" title="Save">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
        </div>
        <div class="history-item__source">${escapeHtml(entry.original)}</div>
        <div class="history-item__target">${escapeHtml(entry.translated)}</div>
      </div>
    `).join('');
    $$('.history-item__star').forEach(btn => { btn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(btn.dataset.id); }); });
  }

  function openSidebar() { dom.sidebarOverlay.classList.add('is-visible'); dom.sidebar.classList.add('is-open'); renderSidebar(); }
  function closeSidebar() { dom.sidebarOverlay.classList.remove('is-visible'); dom.sidebar.classList.remove('is-open'); }

  // ══════════════════════════════════════════════
  // UI & SPEECH
  // ══════════════════════════════════════════════

  function setStatus(state, message, progress = null) {
    if (!dom.translateStatus || !dom.statusText) return;
    dom.translateStatus.classList.remove('is-typing', 'is-loading', 'is-done', 'is-error');
    if (state) dom.translateStatus.classList.add(`is-${state}`);
    
    // If progress is provided (for documents), show a progress bar inside the status text
    if (progress !== null) {
      dom.statusText.innerHTML = `
        ${message}
        <div class="doc-progress is-visible"><div class="doc-progress__bar" style="width: ${progress}%"></div></div>
      `;
    } else {
      dom.statusText.textContent = message;
    }
  }

  function updateCharCount() {
    if (!dom.sourceText || !dom.charCount || activeFile) return;
    const len = dom.sourceText.value.length;
    dom.charCount.textContent = len.toLocaleString();
    if (dom.charCount.parentElement) dom.charCount.parentElement.style.color = len > 4500 ? 'var(--error)' : '';
  }

  function swapLanguages() {
    if (!dom.sourceLang || !dom.targetLang || isTranslatingDocument) return;
    const tempLang = dom.sourceLang.value;
    dom.sourceLang.value = dom.targetLang.value;
    dom.targetLang.value = tempLang;

    if (!activeFile) {
      const resultTextEl = $('.result-card__text');
      if (dom.sourceText && resultTextEl && resultTextEl.textContent.trim()) {
        dom.sourceText.value = resultTextEl.textContent.trim();
        updateCharCount();
      }
    }
    hideResult(); hideError(); lastTranslatedKey = ''; scheduleTranslate(true);
  }

  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onstart = () => {
      isRecording = true;
      if (dom.micBtn) dom.micBtn.classList.add('translate__tool-btn--recording');
      openVoiceOverlay();
      setStatus('typing', 'Listening to your voice…');
    };
    recognition.onresult = (event) => {
      if (activeFile) return;
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      voiceFinalText = transcript;
      if (dom.voiceTranscript) {
        dom.voiceTranscript.textContent = transcript || 'Start speaking…';
      }
    };
    recognition.onerror = () => stopRecording();
    recognition.onend = () => {
      stopRecording();
      if (dom.voiceStatusText) dom.voiceStatusText.textContent = 'Tap ✓ to use text';
      if (dom.voiceOverlay) dom.voiceOverlay.classList.remove('is-listening');
      if (dom.voiceMainBtn) dom.voiceMainBtn.classList.remove('is-listening');
    };
  }

    function formatVoiceTime(total) {
    const m = String(Math.floor(total / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function openVoiceOverlay() {
    if (!dom.voiceOverlay) return;
    voiceSeconds = 0;
    voiceFinalText = '';
    if (dom.voiceTranscript) dom.voiceTranscript.textContent = 'Start speaking…';
    if (dom.voiceStatusText) dom.voiceStatusText.textContent = 'Listening…';
    if (dom.voiceTimer) dom.voiceTimer.textContent = '00:00';

    dom.voiceOverlay.classList.add('is-open', 'is-listening');
    dom.voiceOverlay.setAttribute('aria-hidden', 'false');
    if (dom.voiceMainBtn) dom.voiceMainBtn.classList.add('is-listening');

    if (voiceTimerInterval) clearInterval(voiceTimerInterval);
    voiceTimerInterval = setInterval(() => {
      voiceSeconds += 1;
      if (dom.voiceTimer) dom.voiceTimer.textContent = formatVoiceTime(voiceSeconds);
    }, 1000);
  }

  function closeVoiceOverlay(applyText = false) {
    if (voiceTimerInterval) {
      clearInterval(voiceTimerInterval);
      voiceTimerInterval = null;
    }

    if (dom.voiceOverlay) {
      dom.voiceOverlay.classList.remove('is-open', 'is-listening');
      dom.voiceOverlay.setAttribute('aria-hidden', 'true');
    }
    if (dom.voiceMainBtn) dom.voiceMainBtn.classList.remove('is-listening');

    if (applyText && voiceFinalText && dom.sourceText && !activeFile) {
      dom.sourceText.value = voiceFinalText;
      updateCharCount();
      scheduleTranslate(true);
    }
  }

  function toggleRecording() {
    if (!recognition || activeFile) return;
    if (isRecording) { recognition.stop(); stopRecording(); return; }
    recognition.lang = { en: 'en-US', ur: 'ur-PK', ps: 'ps-AF', ar: 'ar-SA', fr: 'fr-FR', de: 'de-DE', es: 'es-ES', hi: 'hi-IN', zh: 'zh-CN', ja: 'ja-JP' }[dom.sourceLang?.value] || 'en-US';
    try { recognition.start(); } catch (err) {}
  }
  function stopRecording() { isRecording = false; if (dom.micBtn) dom.micBtn.classList.remove('translate__tool-btn--recording'); }

  function stopSpeaking() {
    if (currentAudioPlayer) { currentAudioPlayer.pause(); currentAudioPlayer.currentTime = 0; currentAudioPlayer = null; }
    $$('.translate__tool-btn--speaking, .result-card__action-btn.translate__tool-btn--speaking').forEach((btn) => btn.classList.remove('translate__tool-btn--speaking'));
  }

  function speakText(text, langCode, buttonElement) {
    const cleanText = (text || '').trim();
    if (!cleanText) return;
    stopSpeaking();
    if (buttonElement) buttonElement.classList.add('translate__tool-btn--speaking');
    const targetLang = { en: 'en', ur: 'ur', ps: 'ps', ar: 'ar', fr: 'fr', de: 'de', es: 'es', hi: 'hi', zh: 'zh-CN', ja: 'ja' }[langCode] || 'en';
    currentAudioPlayer = new Audio(`${API_BASE}/tts?text=${encodeURIComponent(cleanText)}&lang=${targetLang}`);
    currentAudioPlayer.play().catch(() => stopSpeaking());
    currentAudioPlayer.onended = () => stopSpeaking();
    currentAudioPlayer.onerror = () => stopSpeaking();
  }

  // ══════════════════════════════════════════════
  // 📄 DOCUMENT HANDLING (CHUNK & TRANSLATE)
  // ══════════════════════════════════════════════

  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 500 * 1024) { // 500KB limit
      showError('File is too large. Maximum size is 500KB.');
      return;
    }

    activeFile = file;
    dom.fileName.textContent = file.name;
    dom.fileSize.textContent = (file.size / 1024).toFixed(1) + ' KB';
    dom.filePreview.classList.add('is-active');
    dom.sourceText.disabled = true;
    dom.charCount.parentElement.style.display = 'none';

    const reader = new FileReader();
    reader.onload = (e) => {
      activeFileContent = e.target.result;
      lastTranslatedKey = '';
      scheduleTranslate(true); // Trigger document translation!
    };
    reader.onerror = () => { showError('Error reading file'); clearFile(); };
    reader.readAsText(file);
  }

  function clearFile() {
    if (isTranslatingDocument) return;
    activeFile = null;
    activeFileContent = '';
    dom.fileInput.value = '';
    dom.filePreview.classList.remove('is-active');
    dom.sourceText.disabled = false;
    dom.charCount.parentElement.style.display = 'block';
    clearAll();
  }

  // Split text into safe chunks without breaking sentences
  function chunkText(text, maxLength) {
    const chunks = [];
    let currentChunk = '';
    const paragraphs = text.split('\n');

    for (const p of paragraphs) {
      if ((currentChunk + p).length > maxLength) {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = p + '\n';
      } else {
        currentChunk += p + '\n';
      }
    }
    if (currentChunk.trim()) chunks.push(currentChunk);
    return chunks;
  }

  // ══════════════════════════════════════════════
  // RENDER RESULT
  // ══════════════════════════════════════════════

  function hideResult() { if (dom.resultArea) { dom.resultArea.classList.remove('is-visible'); dom.resultArea.innerHTML = ''; } }
  function hideError() { if (dom.errorArea) { dom.errorArea.classList.remove('is-visible'); dom.errorArea.innerHTML = ''; } }

  function showError(message) {
    hideResult();
    if (!dom.errorArea) return;
    setStatus('error', 'Translation failed');
    dom.errorArea.innerHTML = `<div class="error-card"><div class="error-card__content"><div class="error-card__title">Translation Failed</div><div class="error-card__message">${escapeHtml(message)}</div><button class="error-card__retry" id="retryBtn">Try Again</button></div></div>`;
    dom.errorArea.classList.add('is-visible');
    const retryBtn = $('#retryBtn');
    if (retryBtn) retryBtn.addEventListener('click', () => scheduleTranslate(true));
  }

  function clearAll() {
    if (dom.sourceText) dom.sourceText.value = '';
    updateCharCount(); hideResult(); hideError(); stopSpeaking();
    lastTranslatedKey = ''; currentTranslationId = null;
    latestContext = { originalText: '', translatedText: '', sourceLang: 'en', targetLang: 'ur' };
    setStatus('', 'Start typing to translate…');
    if (dom.sourceText && !activeFile) dom.sourceText.focus();
  }

  // Show standard text result
  function showResult(data, originalText, sourceLang, targetLang) {
    hideError();
    if (!dom.resultArea) return;

    const { translatedText, meta } = data;
    const tone = meta.tone || currentTone;
    const romanization = (data.romanization || '').trim();
    const isStarred = (historyData.find(e => e.id === currentTranslationId) || {}).isFavorite;

    latestContext = { originalText, translatedText, sourceLang, targetLang };
    setStatus('done', 'Translated');

    dom.resultArea.innerHTML = `
      <div class="result-card" id="resultCard">
        <div class="result-card__header">
          <div class="result-card__badge"><span class="result-card__badge-dot"></span>${toneEmoji(tone)} ${toneLabel(tone)} Translation</div>
          <div class="result-card__actions">
            <button class="result-card__action-btn ${isStarred ? 'is-starred' : ''}" id="starBtn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><span>Save</span></button>
            <button class="result-card__action-btn explain-btn" id="explainBtn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg><span id="explainBtnText">Explain</span></button>
            <button class="result-card__action-btn" id="speakResultBtn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg></button>
            <button class="result-card__action-btn" id="copyBtn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>
            <button class="result-card__action-btn" id="copyBtn" title="Copy">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            </button>

            <!-- ✅ NEW SHARE BUTTON -->
            <button class="result-card__action-btn" id="shareBtn" title="Share translation">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </button>

            <button class="result-card__action-btn" id="clearBtn" title="Clear">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
              </svg>
            </button>
            <button class="result-card__action-btn" id="clearBtn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button>
          </div>
        </div>
        <div class="result-card__body">
          <div class="result-card__text">${escapeHtml(translatedText)}</div>
          ${romanization ? `<div class="result-card__romanization"><svg class="result-card__romanization-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg><div class="result-card__romanization-body"><span class="result-card__romanization-label">Pronunciation</span><div class="result-card__romanization-text">${escapeHtml(romanization)}</div></div></div>` : ''}
        </div>
        <div class="explain-area" id="explainArea"><div class="explain-area__header"><span class="explain-area__badge">✨ AI Breakdown</span></div><div class="explain-area__content" id="explainContent"><div class="explain-skeleton"><div class="explain-skeleton__line"></div><div class="explain-skeleton__line explain-skeleton__line--short"></div></div></div></div>
      </div>
    `;
    dom.resultArea.classList.add('is-visible');

    $('#starBtn')?.addEventListener('click', () => toggleFavorite(currentTranslationId));
    $('#speakResultBtn')?.addEventListener('click', () => speakText(translatedText, targetLang, $('#speakResultBtn')));
    $('#copyBtn')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(translatedText); $('#copyBtn').classList.add('result-card__action-btn--copied'); setTimeout(() => $('#copyBtn').classList.remove('result-card__action-btn--copied'), 1600); } catch (e) {} });
    // Share button
    const shareBtn = $('#shareBtn');
    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        const shareText = translatedText;
        const shareTitle = 'Translūce Translation';

        try {
          // Modern device share sheet (mobile/desktop supporting browsers)
          if (navigator.share) {
            await navigator.share({
              title: shareTitle,
              text: shareText,
            });
            shareBtn.classList.add('is-shared');
            setTimeout(() => shareBtn.classList.remove('is-shared'), 1200);
            return;
          }

          // Fallback: copy to clipboard
          await navigator.clipboard.writeText(shareText);
          shareBtn.classList.add('is-shared');
          shareBtn.setAttribute('title', 'Copied for sharing');
          setTimeout(() => {
            shareBtn.classList.remove('is-shared');
            shareBtn.setAttribute('title', 'Share translation');
          }, 1200);
        } catch (err) {
          // User canceled share sheet, or clipboard blocked
          if (err && err.name === 'AbortError') return;
          console.error('Share failed:', err);
        }
      });
    }
    $('#clearBtn')?.addEventListener('click', clearAll);

    // Explain
    const explainBtn = $('#explainBtn');
    const explainArea = $('#explainArea');
    if (explainBtn && explainArea) {
      let explanationLoaded = false;
      explainBtn.addEventListener('click', async () => {
        if (explainArea.classList.contains('is-visible') && explanationLoaded) { explainArea.classList.remove('is-visible'); return; }
        explainArea.classList.add('is-visible'); explainBtn.classList.add('is-loading');
        try {
          const response = await fetch(`${API_BASE}/explain`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: latestContext.originalText, translatedText: latestContext.translatedText, sourceLang: latestContext.sourceLang, targetLang: latestContext.targetLang }) });
          const json = await response.json();
          if (!response.ok || !json.success) throw new Error();
          $('#explainContent').innerHTML = escapeHtml(json.data.explanation).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
          explanationLoaded = true;
        } catch (err) { $('#explainContent').innerHTML = 'Could not load explanation.'; }
        finally { explainBtn.classList.remove('is-loading'); }
      });
    }
  }

  // 📄 Show Document Download Result
  function showDocumentResult(translatedFullText, fileName) {
    hideError();
    if (!dom.resultArea) return;
    setStatus('done', 'Document Translated Successfully!');

    dom.resultArea.innerHTML = `
      <div class="download-doc-card">
        <div class="download-doc-card__info">
          <svg class="download-doc-card__icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <path d="M12 18v-6"></path>
            <path d="M9 15l3 3 3-3"></path>
          </svg>
          <div class="download-doc-card__text">
            <h4>Translation Complete</h4>
            <p>${toneLabel(currentTone)} Tone • Ready to save</p>
          </div>
        </div>
        <button class="download-btn" id="downloadDocBtn">
          Download File
        </button>
      </div>
    `;
    dom.resultArea.classList.add('is-visible');

    // Create Blob and Download
    $('#downloadDocBtn').addEventListener('click', () => {
      const blob = new Blob([translatedFullText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Translated_${fileName}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // ══════════════════════════════════════════════
  // TRANSLATE LOGIC
  // ══════════════════════════════════════════════

  function scheduleTranslate(immediate = false) {
    const text = activeFile ? activeFileContent : dom.sourceText.value.trim();
    const sourceLang = dom.sourceLang.value;
    const targetLang = dom.targetLang.value;

    if (!text) {
      if (debounceTimer) clearTimeout(debounceTimer);
      hideResult(); hideError(); lastTranslatedKey = ''; currentTranslationId = null; setStatus('', 'Start typing to translate…');
      return;
    }
    if (sourceLang === targetLang) {
      if (debounceTimer) clearTimeout(debounceTimer);
      hideResult(); setStatus('error', 'Source and target languages must be different');
      return;
    }

    if (activeFile) {
      // For documents, always translate immediately (triggered by upload or language/tone change)
      runTranslateDocument(text, sourceLang, targetLang);
      return;
    }

    setStatus('typing', 'Typing…');
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runTranslateText(text, sourceLang, targetLang), immediate ? 0 : DEBOUNCE_MS);
  }

  async function runTranslateText(text, sourceLang, targetLang) {
    const requestKey = `${sourceLang}||${targetLang}||${currentTone}||${text}`;
    if (requestKey === lastTranslatedKey) { setStatus('done', 'Translated'); return; }
    
    const requestId = ++activeRequestId;
    hideError(); setStatus('loading', `AI translating (${toneLabel(currentTone)})…`);

    try {
      const response = await fetch(`${API_BASE}/translate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceLang, targetLang, tone: currentTone }),
      });
      const json = await response.json();
      if (requestId !== activeRequestId) return;
      if (!response.ok || !json.success) throw new Error(json.error || 'Translation failed');

      lastTranslatedKey = requestKey;
      addToHistory(text, json.data.translatedText, sourceLang, targetLang, currentTone);
      showResult(json.data, text, sourceLang, targetLang);
    } catch (error) {
      if (requestId !== activeRequestId) return;
      showError(error.name === 'TypeError' ? 'Unable to connect to backend.' : (error.message || 'Error translating.'));
    }
  }

  // 📄 Chunking Engine for Documents
  async function runTranslateDocument(text, sourceLang, targetLang) {
    const requestKey = `FILE||${sourceLang}||${targetLang}||${currentTone}||${activeFile.name}`;
    if (requestKey === lastTranslatedKey) return;
    
    isTranslatingDocument = true;
    lastTranslatedKey = requestKey;
    hideError(); hideResult();

    const chunks = chunkText(text, CHUNK_SIZE);
    let fullTranslatedText = '';

    for (let i = 0; i < chunks.length; i++) {
      const progress = Math.round((i / chunks.length) * 100);
      setStatus('loading', `Translating document (Part ${i + 1} of ${chunks.length})…`, progress);

      try {
        const response = await fetch(`${API_BASE}/translate`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunks[i], sourceLang, targetLang, tone: currentTone }),
        });
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || 'Document translation failed');
        fullTranslatedText += json.data.translatedText + '\n\n';
      } catch (error) {
        isTranslatingDocument = false;
        showError(error.message || 'Error translating document.');
        return;
      }
    }

    isTranslatingDocument = false;
    showDocumentResult(fullTranslatedText.trim(), activeFile.name);
  }

  function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }

  function getLangMeta(code) {
    return LANG_OPTIONS.find(l => l.code === code) || LANG_OPTIONS[0];
  }

  function flagImg(flagCode, size = 40) {
    // Real country flag image
    return `<img
      class="lang-flag-img"
      src="https://flagcdn.com/w40/${flagCode}.png"
      srcset="https://flagcdn.com/w80/${flagCode}.png 2x"
      width="${size}"
      height="${size}"
      alt="${flagCode.toUpperCase()} flag"
      loading="lazy"
      draggable="false"
    />`;
  }

  function closeAllLangMenus() {
    document.querySelectorAll('.lang-dd').forEach((dd) => {
      dd.classList.remove('is-open');
      const btn = dd.querySelector('.lang-dd__btn');
      const menu = dd.querySelector('.lang-dd__menu');
      if (btn) btn.setAttribute('aria-expanded', 'false');
      if (menu) menu.hidden = true;
    });
  }

  function renderLangMenu(menuEl, selectedCode, onPick) {
    if (!menuEl) return;

    menuEl.innerHTML = LANG_OPTIONS.map((lang) => {
      const active = lang.code === selectedCode;
      return `
        <button type="button"
          class="lang-dd__option ${active ? 'is-active' : ''}"
          data-code="${lang.code}"
          role="option"
          aria-selected="${active}">
          <span class="lang-dd__option-flag">${flagImg(lang.flag, 28)}</span>
          <span class="lang-dd__option-text">${lang.label}</span>
          <svg class="lang-dd__option-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </button>
      `;
    }).join('');

    menuEl.querySelectorAll('.lang-dd__option').forEach((opt) => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        onPick(opt.dataset.code);
      });
    });
  }

  function syncLangButton(type) {
    const selectEl = type === 'source' ? dom.sourceLang : dom.targetLang;
    if (!selectEl) return;

    const meta = getLangMeta(selectEl.value);

    if (type === 'source') {
      if ($('#sourceLangText')) $('#sourceLangText').textContent = meta.label;
      if ($('#sourceLangFlag')) $('#sourceLangFlag').innerHTML = flagImg(meta.flag, 34);
    } else {
      if ($('#targetLangText')) $('#targetLangText').textContent = meta.label;
      if ($('#targetLangFlag')) $('#targetLangFlag').innerHTML = flagImg(meta.flag, 34);
    }
  }

  function setLanguage(type, code, triggerTranslate = true) {
    const selectEl = type === 'source' ? dom.sourceLang : dom.targetLang;
    if (!selectEl) return;

    selectEl.value = code;
    syncLangButton(type);
    closeAllLangMenus();

    // fire native change so existing logic keeps working
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    if (triggerTranslate) scheduleTranslate(true);
  }

  function initLanguageDropdowns() {
    const sourceBtn = $('#sourceLangBtn');
    const targetBtn = $('#targetLangBtn');
    const sourceMenu = $('#sourceLangMenu');
    const targetMenu = $('#targetLangMenu');

    syncLangButton('source');
    syncLangButton('target');

    function bindDropdown(type, btn, menu) {
      if (!btn || !menu) return;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dd = btn.closest('.lang-dd');
        const isOpen = dd.classList.contains('is-open');
        closeAllLangMenus();

        if (!isOpen) {
          const selected = (type === 'source' ? dom.sourceLang : dom.targetLang)?.value;
          renderLangMenu(menu, selected, (code) => setLanguage(type, code, true));
          dd.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
          menu.hidden = false;
        }
      });
    }

    bindDropdown('source', sourceBtn, sourceMenu);
    bindDropdown('target', targetBtn, targetMenu);

    // close when clicking outside
    document.addEventListener('click', () => closeAllLangMenus());

    // keep custom UI synced after swap
    if (dom.swapLangs) {
      dom.swapLangs.addEventListener('click', () => {
        setTimeout(() => {
          syncLangButton('source');
          syncLangButton('target');
        }, 0);
      });
    }
  }

  // ══════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════

  function init() {

    // Voice overlay controls
    if (dom.voiceCloseBtn) dom.voiceCloseBtn.addEventListener('click', () => {
      if (isRecording && recognition) recognition.stop();
      closeVoiceOverlay(false);
    });
    if (dom.voiceCancelBtn) dom.voiceCancelBtn.addEventListener('click', () => {
      if (isRecording && recognition) recognition.stop();
      closeVoiceOverlay(false);
    });
    if (dom.voiceBackdrop) dom.voiceBackdrop.addEventListener('click', () => {
      if (isRecording && recognition) recognition.stop();
      closeVoiceOverlay(false);
    });
    if (dom.voiceDoneBtn) dom.voiceDoneBtn.addEventListener('click', () => {
      if (isRecording && recognition) recognition.stop();
      closeVoiceOverlay(true);
    });
    if (dom.voiceMainBtn) dom.voiceMainBtn.addEventListener('click', () => {
      // tap main mic in overlay to stop listening
      if (isRecording && recognition) recognition.stop();
    });

    // ☀️/🌙 Theme Toggle
    document.addEventListener('click', (e) => {
      const themeBtn = e.target.closest('#themeToggle, .nav__theme-toggle');
      if (themeBtn && themeBtn.id !== 'historyToggle') {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        setTheme(current === 'dark' ? 'light' : 'dark');
      }
    });

    if (dom.sourceText) {
      dom.sourceText.addEventListener('input', () => { updateCharCount(); scheduleTranslate(false); });
      dom.sourceText.addEventListener('paste', () => { setTimeout(() => { updateCharCount(); scheduleTranslate(true); }, 0); });
    }
    
    if (dom.sourceLang) dom.sourceLang.addEventListener('change', () => scheduleTranslate(true));
    if (dom.targetLang) dom.targetLang.addEventListener('change', () => scheduleTranslate(true));
    if (dom.swapLangs) dom.swapLangs.addEventListener('click', swapLanguages);
    
    if (dom.micBtn) { dom.micBtn.addEventListener('click', toggleRecording); initSpeechRecognition(); }
    if (dom.speakSourceBtn) dom.speakSourceBtn.addEventListener('click', () => speakText(dom.sourceText?.value || '', dom.sourceLang?.value || 'en', dom.speakSourceBtn));
    
    // History
    if (dom.historyToggle) dom.historyToggle.addEventListener('click', openSidebar);
    if (dom.closeSidebar) dom.closeSidebar.addEventListener('click', closeSidebar);
    if (dom.sidebarOverlay) dom.sidebarOverlay.addEventListener('click', closeSidebar);
    if (dom.tabHistory && dom.tabSaved) {
      dom.tabHistory.addEventListener('click', () => { currentSidebarTab = 'history'; dom.tabHistory.classList.add('is-active'); dom.tabSaved.classList.remove('is-active'); renderSidebar(); });
      dom.tabSaved.addEventListener('click', () => { currentSidebarTab = 'saved'; dom.tabSaved.classList.add('is-active'); dom.tabHistory.classList.remove('is-active'); renderSidebar(); });
    }

    // 📄 Document Upload
    if (dom.uploadBtn && dom.fileInput) {
      dom.uploadBtn.addEventListener('click', () => dom.fileInput.click());
      dom.fileInput.addEventListener('change', handleFileUpload);
    }
    if (dom.removeFileBtn) dom.removeFileBtn.addEventListener('click', clearFile);

    initLanguageDropdowns();
    initToneSelector();
    updateCharCount();
    setStatus('', 'Start typing to translate…');
    if (dom.sourceText) setTimeout(() => dom.sourceText.focus(), 400);
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } 
  else { init(); }
})();