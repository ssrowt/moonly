const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { validateTelegramInitData } = require('../middleware/auth');

/**
 * GET /api/profile
 *
 * Returns the current user's profile.
 */
router.get('/', validateTelegramInitData, (req, res) => {
  const user = req.user;

  const referralCount = db.prepare(
    'SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?'
  ).get(user.id).count;

  const frontendUrl = process.env.FRONTEND_URL || '';
  const referralLink = `https://t.me/${process.env.BOT_USERNAME || 'moonlybot'}?start=${user.referral_code}`;

  return res.json({
    ok: true,
    profile: {
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      plan: user.plan,
      plan_expires_at: user.plan_expires_at,
      referral_code: user.referral_code,
      referral_count: referralCount,
      referral_link: referralLink,
      notifications_enabled: !!user.notifications_enabled,
      created_at: user.created_at,
    },
  });
});

/**
 * GET /api/referral
 *
 * Returns full referral info including list of referred users.
 */
router.get('/referral', validateTelegramInitData, (req, res) => {
  const user = req.user;

  const referredUsers = db.prepare(`
    SELECT u.id, u.username, u.first_name, r.created_at as joined_at
    FROM referrals r
    JOIN users u ON u.id = r.referred_id
    WHERE r.referrer_id = ?
    ORDER BY r.created_at DESC
    LIMIT 50
  `).all(user.id);

  const referralLink = `https://t.me/${process.env.BOT_USERNAME || 'moonlybot'}?start=${user.referral_code}`;

  return res.json({
    ok: true,
    referral: {
      referral_code: user.referral_code,
      referral_link: referralLink,
      total_count: referredUsers.length,
      referred_users: referredUsers,
    },
  });
});

/**
 * POST /api/profile/notifications
 *
 * Toggle push notifications for the current user.
 * Body: { enabled: true | false }
 */
router.post('/notifications', validateTelegramInitData, (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'enabled must be a boolean' });
  }

  db.prepare('UPDATE users SET notifications_enabled = ? WHERE id = ?').run(enabled ? 1 : 0, req.user.id);

  return res.json({ ok: true, notifications_enabled: enabled });
});

module.exports = router;
