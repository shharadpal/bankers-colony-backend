const express  = require('express');
const crypto   = require('crypto');
const router   = express.Router();
const User     = require('../models/User');
const { sendTokenResponse, protect, signToken } = require('../middleware/auth');
const { sendVerifyEmail, sendPasswordResetEmail } = require('../utils/email');

// ── POST /api/auth/register ──────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, mobile, examCategory } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ ok: false, message: 'Name, email and password are required.' });
    if (password.length < 8)
      return res.status(400).json({ ok: false, message: 'Password must be at least 8 characters.' });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ ok: false, message: 'Email already registered. Please login.' });

    // Create email verify token
    const emailVerifyToken = crypto.randomBytes(32).toString('hex');

    const user = await User.create({
      name, email, password, mobile, examCategory,
      emailVerifyToken,
    });

    // Send verification email (non-blocking)
    sendVerifyEmail(user, emailVerifyToken).catch(console.error);

    sendTokenResponse(user, 201, res);
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ ok: false, message: 'Registration failed. Try again.' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ ok: false, message: 'Email and password are required.' });

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ ok: false, message: 'Invalid email or password.' });

    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Login failed. Try again.' });
  }
});

// ── GET /api/auth/verify-email ───────────────────────────────────
router.get('/verify-email', async (req, res) => {
  try {
    const { token, email } = req.query;
    const user = await User.findOne({ email, emailVerifyToken: token }).select('+emailVerifyToken');
    if (!user)
      return res.redirect(`${process.env.FRONTEND_URL}/login.html?verified=error`);

    user.isEmailVerified  = true;
    user.emailVerifyToken = undefined;
    await user.save({ validateBeforeSave: false });
    res.redirect(`${process.env.FRONTEND_URL}/login.html?verified=success`);
  } catch (err) {
    res.redirect(`${process.env.FRONTEND_URL}/login.html?verified=error`);
  }
});

// ── POST /api/auth/forgot-password ──────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.json({ ok: true, message: 'If this email exists, a reset link was sent.' });

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExp   = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save({ validateBeforeSave: false });

    await sendPasswordResetEmail(user, token);
    res.json({ ok: true, message: 'Password reset link sent to your email.' });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Could not send reset email. Try again.' });
  }
});

// ── POST /api/auth/reset-password ───────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExp: { $gt: Date.now() },
    }).select('+resetPasswordToken +resetPasswordExp');

    if (!user) return res.status(400).json({ ok: false, message: 'Token invalid or expired.' });

    user.password           = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExp   = undefined;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Password reset failed.' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────
router.get('/me', protect, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ── POST /api/auth/logout ────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.cookie('token', '', { expires: new Date(0), httpOnly: true });
  res.json({ ok: true, message: 'Logged out.' });
});

module.exports = router;
