// ================================================================
// COURSES ROUTER
// ================================================================
const express = require('express');
const coursesRouter = express.Router();
const { Course } = require('../models/index');
const { protect } = require('../middleware/auth');

// GET /api/courses
coursesRouter.get('/', async (req, res) => {
  try {
    const { category, examType, access, status = 'published' } = req.query;
    const filter = { status };
    if (category) filter.category = category;
    if (examType) filter.examType = examType;
    if (access)   filter.access   = access;

    const courses = await Course.find(filter).sort({ createdAt: -1 });
    res.json({ ok: true, courses });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// GET /api/courses/:slug
coursesRouter.get('/:slug', async (req, res) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug, status: 'published' });
    if (!course) return res.status(404).json({ ok: false, message: 'Course not found.' });
    res.json({ ok: true, course });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = { coursesRouter };
