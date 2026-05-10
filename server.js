require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const cron       = require('node-cron');
const connectDB  = require('./config/db');

// ── Connect Database ─────────────────────────────────────────────
connectDB();

const app = express();

// ── Security Middleware ──────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://127.0.0.1:5500',   // Live Server (VS Code)
    /\.netlify\.app$/,         // Any Netlify preview URL
    /bankerscolony\.com$/,     // Main domain
  ],
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// ── Rate Limiting ────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  message:  { ok: false, message: 'Too many requests. Try again in 15 minutes.' },
});
app.use('/api/', limiter);

// ── Body Parsing ─────────────────────────────────────────────────
// Note: /api/payments/webhook uses raw body — must come BEFORE json()
app.use('/api/payments/webhook', require('./routes/payments'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// ── Routes ───────────────────────────────────────────────────────
const authRoutes     = require('./routes/auth');
const mcqRoutes      = require('./routes/mcq');
const pdfRoutes      = require('./routes/pdfs');
const adminRoutes    = require('./routes/admin');
const paymentsRoutes = require('./routes/payments');
const { coursesRouter } = require('./routes/courses');
const { dashRouter, newsRouter, contactRouter, awarenessRouter } = require('./routes/misc');

app.use('/api/auth',      authRoutes);
app.use('/api/mcq',       mcqRoutes);
app.use('/api/pdfs',      pdfRoutes);
app.use('/api/courses',   coursesRouter);
app.use('/api/payments',  paymentsRoutes);
app.use('/api/dashboard', dashRouter);
app.use('/api/news',      newsRouter);
app.use('/api/contact',   contactRouter);
app.use('/api/awareness', awarenessRouter);
app.use('/api/admin',     adminRoutes);

// ── Health Check ─────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Bankers Colony API is running ✅', timestamp: new Date() });
});

// ── 404 for unknown API routes ───────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ ok: false, message: `Route ${req.originalUrl} not found.` });
});

// ── Global Error Handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(err.status || 500).json({
    ok:      false,
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong.' : err.message,
  });
});

// ── Daily Awareness Cron — 6:00 AM IST (00:30 UTC) ───────────────
cron.schedule('30 0 * * *', async () => {
  console.log('🤖 Running daily awareness generation...');
  try {
    const { Awareness } = require('./models/index');
    const today   = new Date().toISOString().slice(0, 10);
    const exists  = await Awareness.findOne({ date: today });
    if (exists) return console.log('✅ Awareness already exists for today.');

    const Anthropic = require('@anthropic-ai/sdk');
    const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message   = await client.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Generate 8 fresh Indian banking awareness questions for ${today}. 
        Topics: RBI policy rates, banking regulations, current banking news relevant for JAIIB/CAIIB/IBPS.
        Return ONLY a JSON array: [{"question":"...","answer":"...","explanation":"..."}]`,
      }],
    });
    const questions = JSON.parse(message.content[0].text);
    await Awareness.create({ date: today, questions });
    console.log(`✅ Generated ${questions.length} awareness questions for ${today}`);
  } catch (err) {
    console.error('❌ Cron awareness error:', err.message);
  }
}, { timezone: 'UTC' });

// ── Start Server ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║   🏦  BANKERS COLONY API — RUNNING           ║
║   Port: ${PORT}                                 ║
║   Mode: ${process.env.NODE_ENV || 'development'}                    ║
║   Health: http://localhost:${PORT}/api/health   ║
╚══════════════════════════════════════════════╝
  `);
});
