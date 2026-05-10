// ── EMAIL SENDER ─────────────────────────────────────────────────
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
    to, subject, html,
  });
};

// Welcome + verify email
const sendVerifyEmail = async (user, token) => {
  const url = `${process.env.FRONTEND_URL}/verify-email.html?token=${token}&email=${user.email}`;
  await sendEmail({
    to: user.email,
    subject: 'Verify your Bankers Colony account',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;">
        <h2 style="color:#1E40AF;font-family:Georgia,serif;margin-bottom:12px;">Welcome to Bankers Colony! 🏦</h2>
        <p style="color:#374151;font-size:15px;line-height:1.7;">Hi <strong>${user.name}</strong>,<br>
        Thank you for registering. Please verify your email to activate your account.</p>
        <a href="${url}" style="display:inline-block;background:#2563EB;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:20px 0;">Verify Email →</a>
        <p style="color:#9CA3AF;font-size:13px;">This link expires in 24 hours. If you didn't register, ignore this email.</p>
      </div>
    `,
  });
};

// Password reset email
const sendPasswordResetEmail = async (user, token) => {
  const url = `${process.env.FRONTEND_URL}/login.html?reset=${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Reset your Bankers Colony password',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;">
        <h2 style="color:#1E40AF;font-family:Georgia,serif;">Password Reset Request 🔒</h2>
        <p style="color:#374151;font-size:15px;line-height:1.7;">Hi <strong>${user.name}</strong>, you requested a password reset.</p>
        <a href="${url}" style="display:inline-block;background:#2563EB;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:20px 0;">Reset Password →</a>
        <p style="color:#9CA3AF;font-size:13px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
};

// Payment receipt
const sendPaymentReceipt = async (user, payment) => {
  await sendEmail({
    to: user.email,
    subject: `✅ Payment Confirmed — ${payment.plan} Plan`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;">
        <h2 style="color:#059669;font-family:Georgia,serif;">Payment Successful! ✅</h2>
        <p style="color:#374151;font-size:15px;line-height:1.7;">Hi <strong>${user.name}</strong>, your subscription is now active.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr><td style="padding:8px 0;color:#6B7280;font-size:13px;">Plan</td><td style="font-weight:700;text-align:right;">${payment.plan}</td></tr>
          <tr><td style="padding:8px 0;color:#6B7280;font-size:13px;">Amount</td><td style="font-weight:700;text-align:right;">₹${payment.amount}</td></tr>
          <tr><td style="padding:8px 0;color:#6B7280;font-size:13px;">Payment ID</td><td style="font-weight:700;text-align:right;font-size:12px;">${payment.razorpayPaymentId}</td></tr>
        </table>
        <a href="${process.env.FRONTEND_URL}/dashboard.html" style="display:inline-block;background:#2563EB;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;">Go to Dashboard →</a>
      </div>
    `,
  });
};

module.exports = { sendEmail, sendVerifyEmail, sendPasswordResetEmail, sendPaymentReceipt };
