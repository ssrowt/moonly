const cron = require('node-cron');
const { db } = require('../db');
const { sendExpiryReminder, sendExpiredNotification } = require('../bot/notifications');

/**
 * Runs daily at 9:00 AM UTC.
 *
 * 1. Sends a reminder to users whose plan expires within the next 25 hours.
 * 2. Downgrades and notifies users whose plan has already expired.
 */
function startSubscriptionCheckCron() {
  cron.schedule('0 9 * * *', async () => {
    console.log('[cron] Running subscription expiry check...');

    const now = new Date();
    const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

    // ── 1. Remind users expiring soon ────────────────────────────────────────
    const expiringSoon = db.prepare(`
      SELECT * FROM users
      WHERE plan != 'FREE'
        AND plan_expires_at IS NOT NULL
        AND plan_expires_at > datetime('now')
        AND plan_expires_at <= ?
        AND notifications_enabled = 1
    `).all(in25Hours);

    for (const user of expiringSoon) {
      // Check not already reminded today
      const alreadyReminded = db.prepare(`
        SELECT 1 FROM notification_log
        WHERE user_id = ? AND type = 'PLAN_EXPIRY'
          AND sent_at >= datetime('now', '-23 hours')
      `).get(user.id);

      if (alreadyReminded) continue;

      const msLeft = new Date(user.plan_expires_at) - now;
      const daysLeft = Math.max(1, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

      try {
        await sendExpiryReminder(user, daysLeft);
        db.prepare(`
          INSERT INTO notification_log (user_id, type) VALUES (?, 'PLAN_EXPIRY')
        `).run(user.id);
      } catch (err) {
        console.error(`[cron] Reminder error for user ${user.id}:`, err.message);
      }

      await sleep(50);
    }

    // ── 2. Downgrade expired plans ───────────────────────────────────────────
    const expired = db.prepare(`
      SELECT * FROM users
      WHERE plan != 'FREE'
        AND plan_expires_at IS NOT NULL
        AND plan_expires_at <= datetime('now')
    `).all();

    for (const user of expired) {
      const previousPlan = user.plan;

      db.prepare(`
        UPDATE users SET plan = 'FREE', plan_expires_at = NULL WHERE id = ?
      `).run(user.id);

      if (!user.notifications_enabled) continue;

      // Check not already notified about expiry today
      const alreadyNotified = db.prepare(`
        SELECT 1 FROM notification_log
        WHERE user_id = ? AND type = 'PLAN_EXPIRED'
          AND sent_at >= datetime('now', '-23 hours')
      `).get(user.id);

      if (alreadyNotified) continue;

      try {
        await sendExpiredNotification(user, previousPlan);
        db.prepare(`
          INSERT INTO notification_log (user_id, type) VALUES (?, 'PLAN_EXPIRED')
        `).run(user.id);
      } catch (err) {
        console.error(`[cron] Expiry notification error for user ${user.id}:`, err.message);
      }

      await sleep(50);
    }

    console.log(`[cron] Subscription check done. Reminded: ${expiringSoon.length}, Downgraded: ${expired.length}`);
  }, {
    timezone: 'UTC',
  });

  console.log('[cron] Subscription check scheduled (daily at 09:00 UTC)');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { startSubscriptionCheckCron };
