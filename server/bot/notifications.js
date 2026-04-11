const { db, PLAN_ORDER } = require('../db');
const { getBot } = require('./index');

const FRONTEND_URL = () => process.env.FRONTEND_URL || '';

/**
 * Sends a signal alert to all eligible users.
 * Eligible = user's plan >= signal's premium_level AND notifications_enabled = 1.
 * Uses notification_log to prevent duplicate sends.
 *
 * @param {object} signal - Full signal row from DB
 */
async function dispatchSignalNotifications(signal) {
  const bot = getBot();
  if (!bot) return;

  const signalPlanLevel = PLAN_ORDER[signal.premium_level] ?? 0;

  // Get eligible users
  const users = db.prepare(`
    SELECT id FROM users
    WHERE notifications_enabled = 1
  `).all();

  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    const userRow = db.prepare('SELECT plan FROM users WHERE id = ?').get(user.id);
    const userPlanLevel = PLAN_ORDER[userRow.plan] ?? 0;

    // Skip if plan too low
    if (userPlanLevel < signalPlanLevel) {
      skipped++;
      continue;
    }

    // Skip if already notified for this signal
    const alreadySent = db.prepare(`
      SELECT 1 FROM notification_log
      WHERE user_id = ? AND signal_id = ? AND type = 'NEW_SIGNAL'
    `).get(user.id, signal.id);

    if (alreadySent) {
      skipped++;
      continue;
    }

    try {
      await sendSignalAlert(user.id, signal);

      db.prepare(`
        INSERT INTO notification_log (user_id, signal_id, type)
        VALUES (?, ?, 'NEW_SIGNAL')
      `).run(user.id, signal.id);

      sent++;
    } catch (err) {
      console.error(`[notifications] Failed to notify user ${user.id}:`, err.message);
    }

    // Respect Telegram rate limit: 30 msg/sec max → 50ms delay = 20/sec
    await sleep(50);
  }

  // Mark signal as alerted
  db.prepare('UPDATE signals SET alerted_at = datetime("now") WHERE id = ?').run(signal.id);

  console.log(`[notifications] Signal #${signal.id} dispatched: ${sent} sent, ${skipped} skipped`);
}

/**
 * Sends a single signal alert message to a Telegram user.
 *
 * @param {number} userId - Telegram user ID (= chat ID for private chats)
 * @param {object} signal
 */
async function sendSignalAlert(userId, signal) {
  const bot = getBot();
  if (!bot) return;

  const direction = signal.direction === 'BULLISH' ? '🟢 Bullish' : '🔴 Bearish';
  const tps = [signal.take_profit_1, signal.take_profit_2, signal.take_profit_3]
    .filter(Boolean)
    .map((tp, i) => `TP${i + 1}: ${tp.toLocaleString()}`)
    .join(' • ');

  const text =
    `📊 *New Signal — ${signal.symbol}*\n\n` +
    `${direction} • ${Math.round(signal.confidence_score)}% • ${signal.timeframe}\n\n` +
    `Entry: \`${signal.entry.toLocaleString()}\`\n` +
    `Stop: \`${signal.stop_loss.toLocaleString()}\`\n` +
    `${tps}\n\n` +
    (signal.ai_summary ? `_${signal.ai_summary}_` : '');

  const webAppUrl = `${FRONTEND_URL()}/#/signals/${signal.id}`;

  await bot.sendMessage(userId, text, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '📈 View Signal', web_app: { url: FRONTEND_URL() } },
      ]],
    },
  });
}

/**
 * Sends a subscription expiry reminder.
 *
 * @param {object} user - User row
 * @param {number} daysLeft
 */
async function sendExpiryReminder(user, daysLeft) {
  const bot = getBot();
  if (!bot) return;

  const text =
    `⏰ *Moonly Subscription Reminder*\n\n` +
    `Your *${user.plan}* plan expires in *${daysLeft} day${daysLeft !== 1 ? 's' : ''}*.\n\n` +
    `Renew now to keep full access to signals and AI analysis.`;

  await bot.sendMessage(user.id, text, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: '💎 Renew Plan', web_app: { url: FRONTEND_URL() } }]],
    },
  });
}

/**
 * Sends a subscription expired notification (after downgrade).
 *
 * @param {object} user - User row (plan already downgraded to FREE)
 * @param {string} previousPlan
 */
async function sendExpiredNotification(user, previousPlan) {
  const bot = getBot();
  if (!bot) return;

  const text =
    `😔 *Your ${previousPlan} plan has expired*\n\n` +
    `You now have FREE access to Moonly.\n` +
    `Upgrade to restore full access to all signals and AI analysis.`;

  await bot.sendMessage(user.id, text, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: '💎 Upgrade', web_app: { url: FRONTEND_URL() } }]],
    },
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  dispatchSignalNotifications,
  sendSignalAlert,
  sendExpiryReminder,
  sendExpiredNotification,
};
