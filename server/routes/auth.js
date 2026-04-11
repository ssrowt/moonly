const express = require('express');
const router = express.Router();
const { upsertUser, checkPlanExpiry } = require('../db');

/**
 * POST /api/auth/register
 *
 * Called every time the Mini App opens (idempotent).
 * Creates the user if they don't exist, updates mutable fields if they do.
 *
 * Body (JSON):
 *   {
 *     user: { id, username, first_name },   ← from Telegram.WebApp.initDataUnsafe.user
 *     referral_code?: string                ← optional, from bot deep-link param
 *   }
 *
 * Returns: { ok: true, user: { id, username, first_name, plan, plan_expires_at,
 *             referral_code, notifications_enabled } }
 */
router.post('/register', (req, res) => {
  const { user: telegramUser, referral_code } = req.body;

  if (!telegramUser || !telegramUser.id) {
    return res.status(400).json({ ok: false, error: 'Missing user data' });
  }

  const user = upsertUser({
    id: telegramUser.id,
    username: telegramUser.username,
    first_name: telegramUser.first_name,
    referred_by_code: referral_code || null,
  });

  const freshUser = checkPlanExpiry(user);

  return res.json({
    ok: true,
    user: {
      id: freshUser.id,
      username: freshUser.username,
      first_name: freshUser.first_name,
      plan: freshUser.plan,
      plan_expires_at: freshUser.plan_expires_at,
      referral_code: freshUser.referral_code,
      notifications_enabled: !!freshUser.notifications_enabled,
    },
  });
});

module.exports = router;
