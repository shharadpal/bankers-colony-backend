const express  = require('express');
const crypto   = require('crypto');
const router   = express.Router();
const Razorpay = require('razorpay');
const { Payment } = require('../models/index');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { sendPaymentReceipt } = require('../utils/email');

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const PLANS = {
  basic: { price: 29900, days: 30,  label: 'Basic' },
  pro:   { price: 59900, days: 30,  label: 'Pro'   },
  elite: { price: 99900, days: 30,  label: 'Elite' },
};

// ── POST /api/payments/create-order ─────────────────────────────
router.post('/create-order', protect, async (req, res) => {
  try {
    const { plan } = req.body;
    const planInfo = PLANS[plan];
    if (!planInfo) return res.status(400).json({ ok: false, message: 'Invalid plan.' });

    const order = await razorpay.orders.create({
      amount:   planInfo.price,
      currency: 'INR',
      receipt:  `bc_${req.user._id}_${Date.now()}`,
      notes:    { userId: req.user._id.toString(), plan, userName: req.user.name },
    });

    // Create pending payment record
    await Payment.create({
      userId:          req.user._id,
      plan,
      amount:          planInfo.price / 100,
      razorpayOrderId: order.id,
    });

    res.json({
      ok: true,
      orderId:   order.id,
      amount:    order.amount,
      currency:  order.currency,
      keyId:     process.env.RAZORPAY_KEY_ID,
      userName:  req.user.name,
      userEmail: req.user.email,
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ ok: false, message: 'Could not create payment order.' });
  }
});

// ── POST /api/payments/verify ────────────────────────────────────
router.post('/verify', protect, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, plan } = req.body;

    // Verify signature
    const body   = razorpayOrderId + '|' + razorpayPaymentId;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expected !== razorpaySignature)
      return res.status(400).json({ ok: false, message: 'Invalid payment signature.' });

    // Update payment record
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId },
      { razorpayPaymentId, razorpaySignature, status: 'paid' },
      { new: true },
    );

    // Upgrade user plan
    const planInfo  = PLANS[plan] || PLANS.basic;
    const expiresAt = new Date(Date.now() + planInfo.days * 24 * 60 * 60 * 1000);
    const user      = await User.findByIdAndUpdate(
      req.user._id,
      { plan, planExpiresAt: expiresAt },
      { new: true },
    );

    // Send receipt email
    sendPaymentReceipt(user, payment).catch(console.error);

    res.json({ ok: true, message: 'Payment successful! Your plan is now active.', user });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ ok: false, message: 'Payment verification failed.' });
  }
});

// ── POST /api/payments/webhook ───────────────────────────────────
// Razorpay calls this automatically on payment events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const expected  = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.body)
      .digest('hex');

    if (signature !== expected) return res.status(400).send('Invalid webhook signature');

    const event = JSON.parse(req.body);
    if (event.event === 'payment.failed') {
      const orderId = event.payload.payment.entity.order_id;
      await Payment.findOneAndUpdate({ razorpayOrderId: orderId }, { status: 'failed' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Webhook error');
  }
});

module.exports = router;
