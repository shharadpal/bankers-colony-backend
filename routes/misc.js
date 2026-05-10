// ================================================================
// DASHBOARD ROUTER
// ================================================================
const express   = require('express');
const dashRouter = express.Router();
const User      = require('../models/User');
const { TestAttempt, Payment } = require('../models/index');
const { protect } = require('../middleware/auth');

// GET /api/dashboard
dashRouter.get('/', protect, async (req, res) => {
  try {
    const user     = req.user;
    const tests    = await TestAttempt.find({ userId: user._id }).sort({ completedAt: -1 }).limit(5)
                       .populate('testId', 'title');
    const payments = await Payment.find({ userId: user._id, status: 'paid' }).sort({ createdAt: -1 }).limit(3);

    res.json({
      ok: true,
      user: {
        name:         user.name,
        email:        user.email,
        plan:         user.plan,
        planExpiresAt:user.planExpiresAt,
        stats:        user.stats,
        bookmarks:    user.bookmarks?.length || 0,
      },
      recentTests: tests,
      payments,
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// PUT /api/dashboard/profile
dashRouter.put('/profile', protect, async (req, res) => {
  try {
    const { name, mobile, examCategory } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, mobile, examCategory },
      { new: true, runValidators: true },
    );
    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// PUT /api/dashboard/password
dashRouter.put('/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ ok: false, message: 'New password must be at least 8 characters.' });

    const user = await User.findById(req.user._id).select('+password');
    if (user.password && !(await user.comparePassword(currentPassword)))
      return res.status(401).json({ ok: false, message: 'Current password is incorrect.' });

    user.password = newPassword;
    await user.save();
    res.json({ ok: true, message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ================================================================
// NEWS ROUTER
// ================================================================
const newsRouter = express.Router();
const { News } = require('../models/index');

// GET /api/news
newsRouter.get('/', async (req, res) => {
  try {
    const { category, page = 1, limit = 10 } = req.query;
    const filter = { status: 'published' };
    if (category) filter.category = category;
    const skip = (page - 1) * limit;
    const [news, total] = await Promise.all([
      News.find(filter).skip(skip).limit(Number(limit)).sort({ publishedAt: -1 }),
      News.countDocuments(filter),
    ]);
    res.json({ ok: true, news, total });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// GET /api/news/:slug
newsRouter.get('/:slug', async (req, res) => {
  try {
    const article = await News.findOneAndUpdate(
      { slug: req.params.slug, status: 'published' },
      { $inc: { views: 1 } },
      { new: true },
    );
    if (!article) return res.status(404).json({ ok: false, message: 'Article not found.' });
    res.json({ ok: true, article });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ================================================================
// CONTACT ROUTER
// ================================================================
const contactRouter = express.Router();
const { ContactSubmission } = require('../models/index');
const { sendEmail } = require('../utils/email');
const rateLimit = require('express-rate-limit');

const contactLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 3,
  message: { ok: false, message: 'Too many contact requests. Try again in 1 hour.' }
});

// POST /api/contact
contactRouter.post('/', contactLimit, async (req, res) => {
  try {
    const { name, email, subject, message, category } = req.body;
    if (!name || !email || !subject || !message || message.length < 20)
      return res.status(400).json({ ok: false, message: 'Please fill all fields (minimum 20 characters in message).' });

    const submission = await ContactSubmission.create({ name, email, subject, message, category });

    // Auto-acknowledge to user
    sendEmail({
      to: email,
      subject: `We received your message — Bankers Colony`,
      html: `<p>Hi <strong>${name}</strong>, thank you for contacting us. We will respond within 24 hours on business days.</p>
             <p><strong>Your reference:</strong> ${submission._id}</p>`,
    }).catch(console.error);

    // Notify admin
    sendEmail({
      to: process.env.SMTP_USER,
      subject: `New Contact: ${category} — ${subject}`,
      html: `<p><strong>From:</strong> ${name} (${email})<br><strong>Category:</strong> ${category}<br><strong>Message:</strong><br>${message}</p>`,
    }).catch(console.error);

    res.json({ ok: true, message: 'Message sent! We will respond within 24 hours.' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ================================================================
// AWARENESS ROUTER
// ================================================================
const awarenessRouter = express.Router();
const { Awareness } = require('../models/index');

// GET /api/awareness/today
awarenessRouter.get('/today', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const awareness = await Awareness.findOne({ date: today });
    if (!awareness) return res.json({ ok: true, questions: [], message: 'Generating today\'s awareness...' });
    res.json({ ok: true, questions: awareness.questions, date: today });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = { dashRouter, newsRouter, contactRouter, awarenessRouter };
