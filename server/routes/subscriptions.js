const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { validateTelegramInitData } = require('../middleware/auth');

const PLAN_FEATURES = {
  FREE: [
    'Limited signal access (FREE-tier only)',
    'Basic interface',
  ],
  PRO: [
    'All standard signals',
    'AI Market Analysis',
    'Push notifications',
    'Fast access',
  ],
  LUXE: [
    'Everything in PRO',
    'Premium & high-confidence signals',
    'Priority support',
    'All future features',
  ],
};

const PLAN_DURATIONS_DAYS = { PRO: 7, LUXE: 30 };

/**
 * GET /api/subscription
 *
 * Returns current subscription info + all available plans.
 */
router.get('/', validateTelegramInitData, (req, res) => {
  const user = req.user;

  let daysRemaining = null;
  if (user.plan !== 'FREE' && user.plan_expires_at) {
    const ms = new Date(user.plan_expires_at) - new Date();
    daysRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  return res.json({
    ok: true,
    subscription: {
      plan: user.plan,
      plan_expires_at: user.plan_expires_at,
      days_remaining: daysRemaining,
      features: PLAN_FEATURES[user.plan] || [],
    },
    plans: [
      {
        id: 'FREE',
        label: 'Free',
        period: 'Forever',
        features: PLAN_FEATURES.FREE,
        price: null,
      },
      {
        id: 'PRO',
        label: 'Pro',
        period: 'Weekly',
        duration_days: 7,
        features: PLAN_FEATURES.PRO,
        price: null, // set when payment is integrated
      },
      {
        id: 'LUXE',
        label: 'Luxe',
        period: 'Monthly',
        duration_days: 30,
        features: PLAN_FEATURES.LUXE,
        price: null,
      },
    ],
  });
});

/**
 * POST /api/subscription/activate
 *
 * Activates a plan for the current user.
 * For MVP: called by admin webhook or mock payment flow.
 *
 * Body: { plan: 'PRO' | 'LUXE', payment_ref?: string }
 */
router.post('/activate', validateTelegramInitData, (req, res) => {
  const { plan, payment_ref } = req.body;

  if (!['PRO', 'LUXE'].includes(plan)) {
    return res.status(400).json({ ok: false, error: 'Invalid plan. Must be PRO or LUXE.' });
  }

  const days = PLAN_DURATIONS_DAYS[plan];
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?
  `).run(plan, expiresAt, req.user.id);

  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  return res.json({
    ok: true,
    plan: updatedUser.plan,
    plan_expires_at: updatedUser.plan_expires_at,
    days_remaining: days,
  });
});

module.exports = router;
