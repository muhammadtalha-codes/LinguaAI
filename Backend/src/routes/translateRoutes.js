const express = require('express');
const router = express.Router();
const {
  handleTranslate,
  getLanguages,
  handleTTS,
  handleExplain,
} = require('../controllers/translateController');

router.post('/translate', handleTranslate);
router.get('/languages', getLanguages);
router.get('/tts', handleTTS);
router.post('/explain', handleExplain);

module.exports = router;