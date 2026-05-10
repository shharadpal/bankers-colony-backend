const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const AWS      = require('aws-sdk');
const path     = require('path');
const crypto   = require('crypto');
const { protect, restrict } = require('../middleware/auth');
const { parseBulkMCQ } = require('../utils/mcqParser');
const User = require('../models/User');
const {
  MCQ, Course, PDF, Payment, News,
  SiteSettings, ContactSubmission, MockTest, Awareness,
} = require('../models/index');

// All admin routes require auth + admin role
router.use(protect, restrict('admin', 'superadmin'));

const s3 = new AWS.S3({
  accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region:          process.env.AWS_REGION,
});

// Multer — memory storage for S3 uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed.'), false);
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ── DASHBOARD ────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [users, mcqs, revenue, newContacts] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      MCQ.countDocuments({ status: 'published' }),
      Payment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      ContactSubmission.countDocuments({ status: 'new' }),
    ]);
    res.json({ ok: true, stats: {
      users,
      mcqs,
      revenue: revenue[0]?.total || 0,
      newContacts,
    }});
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ── MCQ MANAGEMENT ───────────────────────────────────────────────

// GET /api/admin/mcq
router.get('/mcq', async (req, res) => {
  try {
    const { course, access, status, page = 1, limit = 50, q } = req.query;
    const filter = {};
    if (course) filter.course = new RegExp(course, 'i');
    if (access) filter.access = access;
    if (status) filter.status = status;
    if (q)      filter.question = new RegExp(q, 'i');
    const skip = (page - 1) * limit;
    const [mcqs, total] = await Promise.all([
      MCQ.find(filter).skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
      MCQ.countDocuments(filter),
    ]);
    res.json({ ok: true, mcqs, total });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// POST /api/admin/mcq — add single MCQ
router.post('/mcq', async (req, res) => {
  try {
    const mcq = await MCQ.create(req.body);
    res.status(201).json({ ok: true, mcq });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

// POST /api/admin/mcq/bulk — bulk paste upload
router.post('/mcq/bulk', async (req, res) => {
  try {
    const { text, preview } = req.body;
    if (!text) return res.status(400).json({ ok: false, message: 'No text provided.' });

    const { parsed, errors, total } = parseBulkMCQ(text);

    if (preview) {
      return res.json({ ok: true, parsed, errors, total, message: `${parsed.length} MCQs parsed, ${errors.length} errors.` });
    }

    if (parsed.length === 0)
      return res.status(400).json({ ok: false, message: 'No valid MCQs found. Check the format.', errors });

    const inserted = await MCQ.insertMany(parsed, { ordered: false });
    res.json({ ok: true, inserted: inserted.length, errors, message: `${inserted.length} MCQs published successfully!` });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// PUT /api/admin/mcq/:id
router.put('/mcq/:id', async (req, res) => {
  try {
    const mcq = await MCQ.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!mcq) return res.status(404).json({ ok: false, message: 'MCQ not found.' });
    res.json({ ok: true, mcq });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

// DELETE /api/admin/mcq/:id
router.delete('/mcq/:id', async (req, res) => {
  try {
    await MCQ.findByIdAndDelete(req.params.id);
    res.json({ ok: true, message: 'MCQ deleted.' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ── COURSES ──────────────────────────────────────────────────────
router.get('/courses', async (req, res) => {
  const courses = await Course.find().sort({ createdAt: -1 });
  res.json({ ok: true, courses });
});

router.post('/courses', async (req, res) => {
  try {
    // Auto-generate slug
    if (!req.body.slug && req.body.name) {
      req.body.slug = req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
    const course = await Course.create(req.body);
    res.status(201).json({ ok: true, course });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

router.put('/courses/:id', async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ ok: true, course });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

router.delete('/courses/:id', async (req, res) => {
  await Course.findByIdAndDelete(req.params.id);
  res.json({ ok: true, message: 'Course deleted.' });
});

// ── PDF NOTES ────────────────────────────────────────────────────
router.get('/pdfs', async (req, res) => {
  const pdfs = await PDF.find().sort({ createdAt: -1 });
  res.json({ ok: true, pdfs });
});

router.post('/pdfs/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, message: 'No PDF file provided.' });

    const ext    = path.extname(req.file.originalname);
    const s3Key  = `pdfs/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;

    await s3.upload({
      Bucket:      process.env.AWS_S3_BUCKET,
      Key:         s3Key,
      Body:        req.file.buffer,
      ContentType: 'application/pdf',
    }).promise();

    const pdf = await PDF.create({
      title:    req.body.title,
      course:   req.body.course,
      examType: req.body.examType,
      access:   req.body.access || 'free',
      s3Key,
      fileSize: req.file.size,
    });

    res.status(201).json({ ok: true, pdf });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

router.delete('/pdfs/:id', async (req, res) => {
  try {
    const pdf = await PDF.findByIdAndDelete(req.params.id);
    if (pdf?.s3Key) {
      s3.deleteObject({ Bucket: process.env.AWS_S3_BUCKET, Key: pdf.s3Key }, () => {});
    }
    res.json({ ok: true, message: 'PDF deleted.' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ── USERS ────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 50, q } = req.query;
    const filter = { role: 'user' };
    if (q) filter.$or = [{ name: new RegExp(q,'i') }, { email: new RegExp(q,'i') }];
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(filter).select('-password').skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);
    res.json({ ok: true, users, total });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const allowed = ['plan', 'planExpiresAt', 'examCategory', 'name', 'mobile'];
    const update  = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ ok: true, user });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

// ── NEWS ─────────────────────────────────────────────────────────
router.get('/news', async (req, res) => {
  const news = await News.find().sort({ createdAt: -1 });
  res.json({ ok: true, news });
});

router.post('/news', async (req, res) => {
  try {
    if (!req.body.slug && req.body.title) {
      req.body.slug = req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
    }
    const article = await News.create(req.body);
    res.status(201).json({ ok: true, article });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

router.put('/news/:id',    async (req, res) => { try { const a = await News.findByIdAndUpdate(req.params.id, req.body, { new:true }); res.json({ ok:true, article:a }); } catch(e) { res.status(400).json({ ok:false, message:e.message }); }});
router.delete('/news/:id', async (req, res) => { await News.findByIdAndDelete(req.params.id); res.json({ ok:true }); });

// ── SITE SETTINGS ────────────────────────────────────────────────
router.get('/settings', async (req, res) => {
  try {
    const settings = await SiteSettings.find();
    const map = {};
    settings.forEach(s => { map[s.key] = s.value; });
    res.json({ ok: true, settings: map });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const updates = req.body; // { key: value, key2: value2, ... }
    await Promise.all(
      Object.entries(updates).map(([key, value]) =>
        SiteSettings.findOneAndUpdate({ key }, { value }, { upsert: true, new: true })
      )
    );
    res.json({ ok: true, message: 'Settings saved.' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ── CONTACT SUBMISSIONS ──────────────────────────────────────────
router.get('/contacts', async (req, res) => {
  const { status, page = 1, limit = 30 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const skip = (page - 1) * limit;
  const [contacts, total] = await Promise.all([
    ContactSubmission.find(filter).skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
    ContactSubmission.countDocuments(filter),
  ]);
  res.json({ ok: true, contacts, total });
});

router.put('/contacts/:id', async (req, res) => {
  const contact = await ContactSubmission.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ ok: true, contact });
});

// ── PAYMENTS ─────────────────────────────────────────────────────
router.get('/payments', async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const skip = (page - 1) * limit;
  const [payments, total] = await Promise.all([
    Payment.find({ status: 'paid' }).populate('userId', 'name email').skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
    Payment.countDocuments({ status: 'paid' }),
  ]);
  res.json({ ok: true, payments, total });
});

// ── AWARENESS GENERATION ─────────────────────────────────────────
router.post('/generate-awareness', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const exists = await Awareness.findOne({ date: today });
    if (exists) return res.json({ ok: true, message: 'Already generated for today.', questions: exists.questions });

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Generate 8 Indian banking awareness MCQ-style questions relevant for today (${today}). 
        Focus on: RBI policy, banking regulations, current affairs for JAIIB/CAIIB/IBPS exams.
        Return ONLY a JSON array with this structure (no markdown):
        [{"question":"...","answer":"...","explanation":"..."}]`,
      }],
    });

    const questions = JSON.parse(message.content[0].text);
    const awareness = await Awareness.create({ date: today, questions });
    res.json({ ok: true, questions: awareness.questions });
  } catch (err) {
    console.error('Awareness generation error:', err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;
