const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:              { type: String, required: true, trim: true },
  email:             { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:          { type: String, select: false },        // null for Google OAuth users
  mobile:            { type: String },
  examCategory:      { type: String, default: 'General' },   // JAIIB, CAIIB, IBPS, etc.
  role:              { type: String, enum: ['user','admin','superadmin'], default: 'user' },
  plan:              { type: String, enum: ['free','basic','pro','elite'], default: 'free' },
  planExpiresAt:     { type: Date },
  isEmailVerified:   { type: Boolean, default: false },
  emailVerifyToken:  { type: String, select: false },
  resetPasswordToken:{ type: String, select: false },
  resetPasswordExp:  { type: Date, select: false },
  googleId:          { type: String },
  avatar:            { type: String },
  bookmarks:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'MCQ' }],
  stats: {
    mcqAttempted:  { type: Number, default: 0 },
    mcqCorrect:    { type: Number, default: 0 },
    testsAttempted:{ type: Number, default: 0 },
    streak:        { type: Number, default: 0 },
    lastActiveDate:{ type: Date },
  },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare passwords
userSchema.methods.comparePassword = async function(candidate) {
  return await bcrypt.compare(candidate, this.password);
};

// Check if plan is active
userSchema.methods.hasPlan = function(required) {
  const hierarchy = { free: 0, basic: 1, pro: 2, elite: 3 };
  if (this.role === 'admin' || this.role === 'superadmin') return true;
  if (hierarchy[this.plan] >= hierarchy[required]) {
    if (!this.planExpiresAt || this.planExpiresAt > new Date()) return true;
  }
  return false;
};

module.exports = mongoose.model('User', userSchema);
