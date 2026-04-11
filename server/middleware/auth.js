const crypto = require('crypto');
const { db, checkPlanExpiry, upsertUser, PLAN_ORDER } = require('../db');

/**
 * Validates Telegram WebApp initData using HMAC-SHA256.
 * Attaches req.user to the request if valid.
 *
 * Clients must send the raw initData string in the header:
 *   X-Telegram-Init-Data: <initData>
 *
 * In development (NODE_ENV !== 'production'), if BOT_TOKEN is not set,
 * validation is skipped and a mock user is attached for testing.
 */
function validateTelegramInitData(req, res, next) {
  // Dev bypass: if no BOT_TOKEN set, upsert a dev user and attach it
  if (process.env.NODE_ENV !== 'production' && !process.env.BOT_TOKEN) {
    let devUser = db.prepare('SELECT * FROM users WHERE id = ?').get(1);
    if (!devUser) {
      // Create dev user with LUXE plan for testing all features
      upsertUser({ id: 1, username: 'devuser', first_name: 'Dev' });
      db.prepare("UPDATE users SET plan = 'LUXE' WHERE id = 1").run();
      devUser = db.prepare('SELECT * FROM users WHERE id = ?').get(1);
    }
    req.user = checkPlanExpiry(devUser);
    return next();
  }

  const rawInitData = req.headers['x-telegram-init-data'];
  if (!rawInitData) {
    return res.status(401).json({ ok: false, error: 'Missing X-Telegram-Init-Data header' });
  }

  // Parse initData query string
  const params = new URLSearchParams(rawInitData);
  const hash = params.get('hash');
  if (!hash) {
    return res.status(401).json({ ok: false, error: 'Missing hash in initData' });
  }

  // Build data-check-string: sorted key=value pairs, excluding hash
  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  // Compute HMAC
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (expectedHash !== hash) {
    return res.status(401).json({ ok: false, error: 'Invalid initData signature' });
  }

  // Check auth_date freshness (reject data older than 1 hour)
  const authDate = parseInt(params.get('auth_date'), 10);
  if (Date.now() / 1000 - authDate > 3600) {
    return res.status(401).json({ ok: false, error: 'initData expired' });
  }

  // Extract user from initData
  let telegramUser;
  try {
    telegramUser = JSON.parse(params.get('user'));
  } catch {
    return res.status(401).json({ ok: false, error: 'Invalid user data in initData' });
  }

  // Load user from DB — auto-create if not found (e.g. after server restart)
  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(telegramUser.id);
  if (!user) {
    upsertUser({
      id: telegramUser.id,
      username: telegramUser.username,
      first_name: telegramUser.first_name,
    });
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(telegramUser.id);
  }

  req.user = checkPlanExpiry(user);
  next();
}

/**
 * Middleware factory: blocks access if user's plan is below the required level.
 * Usage: router.get('/route', requirePlan('PRO'), handler)
 */
function requirePlan(minimumPlan) {
  return (req, res, next) => {
    const userPlanLevel = PLAN_ORDER[req.user.plan] ?? 0;
    const requiredPlanLevel = PLAN_ORDER[minimumPlan] ?? 0;

    if (userPlanLevel < requiredPlanLevel) {
      return res.status(403).json({
        ok: false,
        error: 'PLAN_REQUIRED',
        required: minimumPlan,
        current: req.user.plan,
      });
    }
    next();
  };
}

/**
 * Validates the ADMIN_KEY header for admin-only routes.
 */
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ ok: false, error: 'Forbidden' });
  }
  next();
}

module.exports = { validateTelegramInitData, requirePlan, requireAdmin };
