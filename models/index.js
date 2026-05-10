// ── MCQ ──────────────────────────────────────────────────────────
const mongoose = require('mongoose');

const mcqSchema = new mongoose.Schema({
  course:      { type: String, required: true },   // 'Banking Awareness', 'JAIIB - PPB', etc.
  examType:    { type: String },                   // 'jaiib', 'caiib', 'ibps', etc.
  subject:     { type: String },
  question:    { type: String, required: true },
  options:     {
    A: { type: String, required: true },
    B: { type: String, required: true },
    C: { type: String, required: true },
    D: { type: String, required: true },
  },
  answer:      { type: String, required: true, enum: ['A','B','C','D'] },
  explanation: { type: String },
  difficulty:  { type: String, enum: ['Easy','Medium','Hard'], default: 'Medium' },
  access:      { type: String, enum: ['free','paid'], default: 'free' },
  tags:        [String],
  status:      { type: String, enum: ['published','draft'], default: 'published' },
  attempts:    { type: Number, default: 0 },
  correctCount:{ type: Number, default: 0 },
}, { timestamps: true });

mcqSchema.index({ course: 1, examType: 1, access: 1, status: 1 });

// ── COURSE ────────────────────────────────────────────────────────
const courseSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  slug:        { type: String, unique: true },
  category:    { type: String },                   // 'professional', 'competitive'
  examType:    { type: String },                   // 'jaiib', 'caiib', etc.
  description: { type: String },
  icon:        { type: String, default: '📋' },
  price:       { type: Number, default: 0 },
  access:      { type: String, enum: ['free','basic','pro','elite'], default: 'pro' },
  showOnHomepage: { type: Boolean, default: true },
  status:      { type: String, enum: ['published','draft'], default: 'published' },
  enrollCount: { type: Number, default: 0 },
  mcqCount:    { type: Number, default: 0 },
  pdfCount:    { type: Number, default: 0 },
  testCount:   { type: Number, default: 0 },
}, { timestamps: true });

// ── PDF ───────────────────────────────────────────────────────────
const pdfSchema = new mongoose.Schema({
  title:         { type: String, required: true },
  course:        { type: String },
  examType:      { type: String },
  s3Key:         { type: String, required: true },  // AWS S3 object key — never expose
  fileSize:      { type: Number },                  // bytes
  pages:         { type: Number },
  access:        { type: String, enum: ['free','pro','elite'], default: 'free' },
  downloadCount: { type: Number, default: 0 },
  status:        { type: String, enum: ['published','draft'], default: 'published' },
}, { timestamps: true });

// ── PAYMENT ───────────────────────────────────────────────────────
const paymentSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan:            { type: String, required: true },
  amount:          { type: Number, required: true },
  currency:        { type: String, default: 'INR' },
  razorpayOrderId: { type: String },
  razorpayPaymentId:{ type: String },
  razorpaySignature:{ type: String },
  status:          { type: String, enum: ['created','paid','failed','refunded'], default: 'created' },
  planDays:        { type: Number, default: 30 },
}, { timestamps: true });

// ── NEWS ──────────────────────────────────────────────────────────
const newsSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  slug:        { type: String, unique: true },
  body:        { type: String },
  category:    { type: String, default: 'Banking News' },
  author:      { type: String, default: 'Bankers Colony Editorial' },
  status:      { type: String, enum: ['published','draft'], default: 'published' },
  examTags:    [String],
  views:       { type: Number, default: 0 },
  publishedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// ── SITE SETTINGS ─────────────────────────────────────────────────
const siteSettingsSchema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

// ── CONTACT SUBMISSION ────────────────────────────────────────────
const contactSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  email:       { type: String, required: true },
  subject:     { type: String, required: true },
  message:     { type: String, required: true },
  category:    { type: String, default: 'General' },
  status:      { type: String, enum: ['new','read','replied'], default: 'new' },
  repliedAt:   { type: Date },
}, { timestamps: true });

// ── DAILY AWARENESS ───────────────────────────────────────────────
const awarenessSchema = new mongoose.Schema({
  date:        { type: String, required: true, unique: true }, // 'YYYY-MM-DD'
  questions:   [{
    question:    String,
    answer:      String,
    explanation: String,
  }],
  generatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// ── MOCK TEST ─────────────────────────────────────────────────────
const mockTestSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  course:      { type: String },
  examType:    { type: String },
  questions:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'MCQ' }],
  duration:    { type: Number, default: 60 },          // minutes
  totalMarks:  { type: Number, default: 100 },
  access:      { type: String, enum: ['free','pro','elite'], default: 'free' },
  status:      { type: String, enum: ['published','draft'], default: 'published' },
  attemptCount:{ type: Number, default: 0 },
}, { timestamps: true });

// ── TEST ATTEMPT ──────────────────────────────────────────────────
const testAttemptSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  testId:      { type: mongoose.Schema.Types.ObjectId, ref: 'MockTest', required: true },
  answers:     [{ questionId: String, selected: String }],
  score:       { type: Number },
  totalMarks:  { type: Number },
  percentage:  { type: Number },
  timeTaken:   { type: Number },                       // seconds
  completedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = {
  MCQ:               mongoose.model('MCQ',               mcqSchema),
  Course:            mongoose.model('Course',            courseSchema),
  PDF:               mongoose.model('PDF',               pdfSchema),
  Payment:           mongoose.model('Payment',           paymentSchema),
  News:              mongoose.model('News',              newsSchema),
  SiteSettings:      mongoose.model('SiteSettings',      siteSettingsSchema),
  ContactSubmission: mongoose.model('ContactSubmission', contactSchema),
  Awareness:         mongoose.model('Awareness',         awarenessSchema),
  MockTest:          mongoose.model('MockTest',          mockTestSchema),
  TestAttempt:       mongoose.model('TestAttempt',       testAttemptSchema),
};
