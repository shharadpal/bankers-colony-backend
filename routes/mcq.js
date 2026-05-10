const express = require('express');
const router  = express.Router();
const { MCQ, TestAttempt } = require('../models/index');
const { protect, requirePlan } = require('../middleware/auth');
const User = require('../models/User');

// ── GET /api/mcq ─────────────────────────────────────────────────
// Public — free MCQs visible to all. Paid MCQs: question shown, answer hidden.
router.get('/', async (req, res) => {
  try {
    const { course, examType, difficulty, access, page = 1, limit = 20, q } = req.query;
    const filter = { status: 'published' };
    if (course)     filter.course     = new RegExp(course, 'i');
    if (examType)   filter.examType   = examType;
    if (difficulty) filter.difficulty = difficulty;
    if (access)     filter.access     = access;
    if (q)          filter.question   = new RegExp(q, 'i');

    const skip = (page - 1) * limit;
    const [mcqs, total] = await Promise.all([
      MCQ.find(filter).skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
      MCQ.countDocuments(filter),
    ]);

    // Strip answer/explanation from paid MCQs for unauthenticated users
    const user = req.user;
    const sanitized = mcqs.map(m => {
      const obj = m.toObject();
      if (m.access === 'paid' && (!user || !user.hasPlan('basic'))) {
        delete obj.answer;
        delete obj.explanation;
        obj.locked = true;
      }
      return obj;
    });

    res.json({ ok: true, mcqs: sanitized, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ── POST /api/mcq/submit ─────────────────────────────────────────
// Auth required — submit answer, get result
router.post('/submit', protect, async (req, res) => {
  try {
    const { mcqId, selected } = req.body;
    const mcq = await MCQ.findById(mcqId);
    if (!mcq) return res.status(404).json({ ok: false, message: 'MCQ not found.' });

    if (mcq.access === 'paid' && !req.user.hasPlan('basic')) {
      return res.status(403).json({ ok: false, message: 'Upgrade to access this question.', upgrade: true });
    }

    const isCorrect = selected === mcq.answer;

    // Update stats
    mcq.attempts++;
    if (isCorrect) mcq.correctCount++;
    await mcq.save();

    // Update user stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: {
        'stats.mcqAttempted': 1,
        'stats.mcqCorrect':   isCorrect ? 1 : 0,
      },
      'stats.lastActiveDate': new Date(),
    });

    res.json({
      ok: true,
      correct:     isCorrect,
      answer:      mcq.answer,
      explanation: mcq.explanation,
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ── POST /api/mcq/bookmark ───────────────────────────────────────
router.post('/bookmark', protect, async (req, res) => {
  try {
    const { mcqId, action } = req.body;  // action: 'add' | 'remove'
    const update = action === 'add'
      ? { $addToSet: { bookmarks: mcqId } }
      : { $pull:     { bookmarks: mcqId } };
    await User.findByIdAndUpdate(req.user._id, update);
    res.json({ ok: true, message: action === 'add' ? 'Bookmarked!' : 'Bookmark removed.' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;
