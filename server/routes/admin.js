const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { requireAdmin } = require('../middleware/auth');

// All admin routes require X-Admin-Key header
router.use(requireAdmin);

/**
 * POST /api/admin/signals
 *
 * Creates a new signal. Triggers push notifications immediately.
 *
 * Body: {
 *   symbol, direction, confidence_score, timeframe,
 *   entry, stop_loss, take_profit_1,
 *   take_profit_2?, take_profit_3?,
 *   ai_summary?, premium_level?, expires_at?
 * }
 */
router.post('/signals', (req, res) => {
  const {
    symbol, direction, confidence_score, timeframe,
    entry, stop_loss, take_profit_1,
    take_profit_2 = null, take_profit_3 = null,
    ai_summary = null,
    premium_level = 'FREE',
    expires_at = null,
  } = req.body;

  // Basic validation
  const required = { symbol, direction, confidence_score, timeframe, entry, stop_loss, take_profit_1 };
  for (const [field, val] of Object.entries(required)) {
    if (val === undefined || val === null || val === '') {
      return res.status(400).json({ ok: false, error: `Missing required field: ${field}` });
    }
  }

  if (!['BULLISH', 'BEARISH'].includes(direction)) {
    return res.status(400).json({ ok: false, error: 'direction must be BULLISH or BEARISH' });
  }
  if (!['FREE', 'PRO', 'LUXE'].includes(premium_level)) {
    return res.status(400).json({ ok: false, error: 'premium_level must be FREE, PRO, or LUXE' });
  }

  const result = db.prepare(`
    INSERT INTO signals
      (symbol, direction, confidence_score, timeframe, entry, stop_loss,
       take_profit_1, take_profit_2, take_profit_3, ai_summary, premium_level, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    symbol, direction, confidence_score, timeframe,
    entry, stop_loss, take_profit_1, take_profit_2, take_profit_3,
    ai_summary, premium_level, expires_at
  );

  const signal = db.prepare('SELECT * FROM signals WHERE id = ?').get(result.lastInsertRowid);

  // Trigger notifications asynchronously (don't block the response)
  setImmediate(() => {
    try {
      const { dispatchSignalNotifications } = require('../bot/notifications');
      dispatchSignalNotifications(signal);
    } catch (err) {
      console.error('[admin] Notification dispatch error:', err.message);
    }
  });

  return res.status(201).json({ ok: true, signal });
});

/**
 * PATCH /api/admin/signals/:id
 *
 * Update signal status.
 * Body: { status: 'ACTIVE' | 'HIT_TP' | 'HIT_SL' | 'EXPIRED' }
 */
router.patch('/signals/:id', (req, res) => {
  const { status } = req.body;
  if (!['ACTIVE', 'HIT_TP', 'HIT_SL', 'EXPIRED'].includes(status)) {
    return res.status(400).json({ ok: false, error: 'Invalid status' });
  }

  const signal = db.prepare('SELECT id FROM signals WHERE id = ?').get(req.params.id);
  if (!signal) {
    return res.status(404).json({ ok: false, error: 'Signal not found' });
  }

  db.prepare('UPDATE signals SET status = ? WHERE id = ?').run(status, req.params.id);
  const updated = db.prepare('SELECT * FROM signals WHERE id = ?').get(req.params.id);

  return res.json({ ok: true, signal: updated });
});

/**
 * POST /api/admin/analysis
 *
 * Creates or replaces the current AI analysis snapshot.
 *
 * Body: {
 *   market_sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
 *   fear_greed_index?: number (0-100),
 *   top_opportunities: [ { symbol, reason } ],
 *   risk_level: 'LOW' | 'MEDIUM' | 'HIGH',
 *   volatility_note?: string,
 *   ai_insights: [ string ]
 * }
 */
router.post('/analysis', (req, res) => {
  const {
    market_sentiment,
    fear_greed_index = null,
    top_opportunities = [],
    risk_level,
    volatility_note = null,
    ai_insights = [],
  } = req.body;

  if (!['BULLISH', 'BEARISH', 'NEUTRAL'].includes(market_sentiment)) {
    return res.status(400).json({ ok: false, error: 'Invalid market_sentiment' });
  }
  if (!['LOW', 'MEDIUM', 'HIGH'].includes(risk_level)) {
    return res.status(400).json({ ok: false, error: 'Invalid risk_level' });
  }

  const result = db.prepare(`
    INSERT INTO analysis_snapshots
      (market_sentiment, fear_greed_index, top_opportunities, risk_level, volatility_note, ai_insights)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    market_sentiment,
    fear_greed_index,
    JSON.stringify(top_opportunities),
    risk_level,
    volatility_note,
    JSON.stringify(ai_insights)
  );

  const snapshot = db.prepare('SELECT * FROM analysis_snapshots WHERE id = ?').get(result.lastInsertRowid);

  return res.status(201).json({ ok: true, analysis: snapshot });
});

/**
 * PATCH /api/admin/users/:id/plan
 *
 * Manually set a user's plan (e.g., after payment confirmation).
 * Body: { plan: 'FREE' | 'PRO' | 'LUXE', days?: number }
 */
router.patch('/users/:id/plan', (req, res) => {
  const { plan, days } = req.body;

  if (!['FREE', 'PRO', 'LUXE'].includes(plan)) {
    return res.status(400).json({ ok: false, error: 'Invalid plan' });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ ok: false, error: 'User not found' });
  }

  let expiresAt = null;
  if (plan !== 'FREE' && days) {
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  db.prepare('UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?').run(plan, expiresAt, req.params.id);
  const updated = db.prepare('SELECT id, username, first_name, plan, plan_expires_at FROM users WHERE id = ?').get(req.params.id);

  return res.json({ ok: true, user: updated });
});

/**
 * GET /api/admin/users
 *
 * List all users (paginated).
 */
router.get('/users', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 50);
  const offset = (page - 1) * limit;

  const users = db.prepare(`
    SELECT id, username, first_name, plan, plan_expires_at,
           notifications_enabled, referral_code, created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const total = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

  return res.json({ ok: true, users, total, page, limit });
});

module.exports = router;
