const express = require('express');
const router  = express.Router();
const AWS     = require('aws-sdk');
const { PDF } = require('../models/index');
const { protect } = require('../middleware/auth');

const s3 = new AWS.S3({
  accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region:          process.env.AWS_REGION,
});

// GET /api/pdfs  — list all published PDFs
router.get('/', async (req, res) => {
  try {
    const { examType, access } = req.query;
    const filter = { status: 'published' };
    if (examType) filter.examType = examType;
    if (access)   filter.access   = access;
    const pdfs = await PDF.find(filter, '-s3Key').sort({ createdAt: -1 });
    res.json({ ok: true, pdfs });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// GET /api/pdfs/:id/download  — get secure presigned URL
router.get('/:id/download', protect, async (req, res) => {
  try {
    const pdf = await PDF.findById(req.params.id);
    if (!pdf || pdf.status !== 'published')
      return res.status(404).json({ ok: false, message: 'PDF not found.' });

    // Plan check
    if (pdf.access !== 'free' && !req.user.hasPlan(pdf.access)) {
      return res.status(403).json({
        ok: false,
        message: `This PDF requires ${pdf.access} plan.`,
        upgrade: true,
      });
    }

    // Generate presigned URL (5 min expiry)
    const url = s3.getSignedUrl('getObject', {
      Bucket:  process.env.AWS_S3_BUCKET,
      Key:     pdf.s3Key,
      Expires: 300,
    });

    // Increment download count
    pdf.downloadCount++;
    await pdf.save();

    res.json({ ok: true, url });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;
