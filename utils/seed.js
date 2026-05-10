require('dotenv').config();
const connectDB = require('../config/db');
const User      = require('../models/User');
const { MCQ, Course, SiteSettings } = require('../models/index');

const seed = async () => {
  await connectDB();
  console.log('🌱 Starting seed...');

  // ── Create super admin ─────────────────────────────────────────
  const existingAdmin = await User.findOne({ email: process.env.ADMIN_EMAIL });
  if (!existingAdmin) {
    await User.create({
      name:            process.env.ADMIN_NAME || 'Admin',
      email:           process.env.ADMIN_EMAIL,
      password:        process.env.ADMIN_PASSWORD,
      role:            'superadmin',
      plan:            'elite',
      isEmailVerified: true,
    });
    console.log(`✅ Admin created: ${process.env.ADMIN_EMAIL}`);
  } else {
    console.log('⚠️  Admin already exists, skipping.');
  }

  // ── Default site settings ──────────────────────────────────────
  const defaultSettings = [
    { key: 'site_name',   value: 'Bankers Colony' },
    { key: 'tagline',     value: 'Banking Exam Preparation' },
    { key: 'hero_title',  value: 'Ace Your Banking Exams with Expert Guidance' },
    { key: 'hero_sub',    value: 'Complete preparation for JAIIB, CAIIB, Bank Promotion and Foreign Posting Exams.' },
    { key: 'ticker_items',value: ['JAIIB May 2026 — Exam Dates Announced', 'IBPS RRB 2026 Notification Released', 'CAIIB Result Declared — Check Now'] },
    { key: 'social_links',value: { telegram: '', whatsapp: '', youtube: '', instagram: '', facebook: '' } },
    { key: 'contact_email', value: 'support@bankerscolony.com' },
  ];

  for (const setting of defaultSettings) {
    await SiteSettings.findOneAndUpdate({ key: setting.key }, setting, { upsert: true });
  }
  console.log('✅ Default site settings created.');

  // ── Sample courses ─────────────────────────────────────────────
  const coursesExist = await Course.countDocuments();
  if (coursesExist === 0) {
    await Course.insertMany([
      { name: 'JAIIB — Complete Preparation 2026', slug: 'jaiib-2026', category: 'professional', examType: 'jaiib', icon: '📋', price: 599, access: 'pro',  status: 'published', enrollCount: 1240 },
      { name: 'CAIIB — Advanced Banking',          slug: 'caiib-2026', category: 'professional', examType: 'caiib', icon: '🏅', price: 699, access: 'pro',  status: 'published', enrollCount: 840  },
      { name: 'Bank Promotion Exam — Scale I→II',  slug: 'promotion-scale-1', category: 'professional', examType: 'promotion', icon: '📈', price: 499, access: 'basic', status: 'published', enrollCount: 620 },
      { name: 'Banking Awareness — Free MCQs',     slug: 'banking-awareness-free', category: 'competitive', examType: 'banking', icon: '🏦', price: 0, access: 'free', status: 'published', enrollCount: 18400 },
      { name: 'IBPS PO / Clerk — Full Prep',       slug: 'ibps-po-clerk', category: 'competitive', examType: 'ibps', icon: '🎓', price: 399, access: 'pro', status: 'published', enrollCount: 4200 },
    ]);
    console.log('✅ Sample courses created.');
  }

  // ── Sample MCQs ────────────────────────────────────────────────
  const mcqCount = await MCQ.countDocuments();
  if (mcqCount === 0) {
    await MCQ.insertMany([
      {
        course: 'Banking Awareness', examType: 'banking', difficulty: 'Easy', access: 'free', status: 'published',
        question: 'What is the current Cash Reserve Ratio (CRR) maintained by Indian commercial banks with RBI?',
        options: { A: '4.00%', B: '4.50%', C: '3.50%', D: '5.00%' },
        answer: 'A',
        explanation: 'CRR is currently 4.00% as of May 2026. It is the percentage of deposits banks must maintain as cash with RBI.',
      },
      {
        course: 'Banking Awareness', examType: 'banking', difficulty: 'Medium', access: 'free', status: 'published',
        question: 'Under the SARFAESI Act 2002, how many days must pass after notice before a bank can take possession of secured assets?',
        options: { A: '30 days', B: '45 days', C: '60 days', D: '90 days' },
        answer: 'C',
        explanation: 'Under Section 13(2) of SARFAESI Act 2002, banks must wait 60 days after issuing demand notice before taking possession.',
      },
      {
        course: 'JAIIB - PPB', examType: 'jaiib', difficulty: 'Easy', access: 'free', status: 'published',
        question: 'Which of the following is NOT a function of the Reserve Bank of India?',
        options: { A: 'Issuing currency notes', B: 'Banker to the Government', C: 'Lender of Last Resort', D: 'Accepting deposits from public' },
        answer: 'D',
        explanation: 'RBI does not accept deposits from the general public. This is a function of commercial banks. RBI issues currency, acts as banker to government, and is lender of last resort.',
      },
      {
        course: 'Quantitative Aptitude', examType: 'ibps', difficulty: 'Medium', access: 'free', status: 'published',
        question: 'A principal of ₹10,000 at 10% per annum compound interest for 2 years. What is the compound interest?',
        options: { A: '₹2,000', B: '₹2,100', C: '₹1,900', D: '₹2,200' },
        answer: 'B',
        explanation: 'CI = P[(1+r/100)^n - 1] = 10000[(1.10)^2 - 1] = 10000 × 0.21 = ₹2,100',
      },
      {
        course: 'Banking Awareness', examType: 'banking', difficulty: 'Hard', access: 'paid', status: 'published',
        question: 'What is the provision requirement for Sub-Standard NPA assets under RBI prudential norms?',
        options: { A: '10%', B: '15%', C: '20%', D: '25%' },
        answer: 'B',
        explanation: 'For Sub-Standard assets, RBI requires 15% provision. For Doubtful assets (up to 1 year) it is 25%, and for Loss assets it is 100%.',
      },
    ]);
    console.log('✅ Sample MCQs created.');
  }

  console.log('\n🎉 Seed complete! Your backend is ready.');
  console.log(`\n   Admin Login:`);
  console.log(`   Email:    ${process.env.ADMIN_EMAIL}`);
  console.log(`   Password: ${process.env.ADMIN_PASSWORD}`);
  console.log(`\n   Open admin panel and use these credentials.\n`);
  process.exit(0);
};

seed().catch(err => { console.error('❌ Seed error:', err); process.exit(1); });
