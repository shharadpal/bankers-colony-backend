const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// ── Protect: require valid JWT ──────────────────────────────────
const protect = async (req, res, next) => {
  try {
    let token;

    // Accept token from Authorization header OR cookie
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ ok: false, message: 'Not authenticated. Please log in.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ ok: false, message: 'User no longer exists.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: 'Invalid or expired token.' });
  }
};

// ── Restrict: require specific role ────────────────────────────
const restrict = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ ok: false, message: 'Access denied. Admin only.' });
  }
  next();
};

// ── Plan Guard: require plan level ──────────────────────────────
const requirePlan = (plan) => (req, res, next) => {
  if (!req.user.hasPlan(plan)) {
    return res.status(403).json({
      ok: false,
      message: `This content requires ${plan} plan or higher.`,
      upgrade: true,
    });
  }
  next();
};

// Generate JWT token
const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN || '30d',
});

// Send token as cookie + JSON
const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'None',
  };
  res.cookie('token', token, cookieOptions);
  user.password = undefined;
  res.status(statusCode).json({ ok: true, token, user });
};

module.exports = { protect, restrict, requirePlan, signToken, sendTokenResponse };
