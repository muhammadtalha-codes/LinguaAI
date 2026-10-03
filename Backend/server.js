require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const translateRoutes = require('./src/routes/translateRoutes');
const { globalErrorHandler } = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type'],
}));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    success: false,
    error: 'Too many requests. Please wait a moment before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'AI Translation Platform API is running',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', translateRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

app.use(globalErrorHandler);

app.listen(PORT, () => {
  console.log(`\n✦  AI Translation Platform`);
  console.log(`   Server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});