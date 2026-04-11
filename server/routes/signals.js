const express = require('express');
const router = express.Router();
const { db, PLAN_ORDER } = require('../db');
const { validateTelegramInitData, requirePlan } = require('../middleware/auth');

/**
 * GET /api/signals
 *
 * Returns signal list filtered by user's plan.
 * Signals above the user's tier are returned as locked (no sensitive fields).
 *
 * Query params:
 *   page=1, limit=20, direction=BULLISH|BEARISH, timeframe=1H|4H|1D, status=ACTIVE
 */
router.get('/', validateTelegramInitData, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  let conditions = [];
  let params = [];

  if (req.query.direction) {
    conditions.push('direction = ?');
    params.push(req.query.direction.toUpperCase());
  }
  if (req.query.timeframe) {
    conditions.push('timeframe = ?');
    params.push(req.query.timeframe.toUpperCase());
  }
  if (req.query.status) {
    conditions.push('status = ?');
    params.push(req.query.status.toUpperCase());
  } else {
    conditions.push("status = 'ACTIVE'");
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT id, symbol, direction, confidence_score, timeframe, status,
           premium_level, created_at
    FROM signals
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const userPlanLevel = PLAN_ORDER[req.user.plan] ?? 0;

  const signals = rows.map((signal) => {
    const signalPlanLevel = PLAN_ORDER[signal.premium_level] ?? 0;
    if (signalPlanLevel > userPlanLevel) {
      // Return locked card — enough info for display, no trading data
      return {
        id: signal.id,
        symbol: signal.symbol,
        direction: signal.direction,
        timeframe: signal.timeframe,
        premium_level: signal.premium_level,
        created_at: signal.created_at,
        locked: true,
      };
    }
    return { ...signal, locked: false };
  });

  return res.json({ ok: true, signals, page, limit });
});

/**
 * GET /api/signals/live
 *
 * Proxies to external signals API based on user's plan.
 * FREE=5 signals, PRO=10, LUXE=20 + analysis field.
 */
const PLAN_EXTERNAL  = { FREE: 'free', PRO: 'pro', LUXE: 'deluxe' };
const SIGNALS_BASE   = process.env.SIGNALS_API_URL || 'https://moonly-1.onrender.com';

router.get('/live', validateTelegramInitData, async (req, res) => {
  const userPlan     = req.user.plan;
  const externalPlan = PLAN_EXTERNAL[userPlan] ?? 'free';

  try {
    const response = await fetch(`${SIGNALS_BASE}/signals?plan=${externalPlan}`, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'API error');
    return res.json({ ok: true, signals: data.signals ?? [], plan: userPlan, updated_at: data.updated_at });
  } catch (err) {
    console.error('[signals/live]', err.message);
    return res.status(502).json({ ok: false, error: 'External API unavailable' });
  }
});

/**
 * GET /api/signals/:id
 *
 * Returns full signal detail including entry, SL, TPs, AI summary.
 * Returns 403 if the signal's premium_level exceeds the user's plan.
 */
router.get('/:id', validateTelegramInitData, (req, res) => {
  const signal = db.prepare('SELECT * FROM signals WHERE id = ?').get(req.params.id);

  if (!signal) {
    return res.status(404).json({ ok: false, error: 'Signal not found' });
  }

  const userPlanLevel = PLAN_ORDER[req.user.plan] ?? 0;
  const signalPlanLevel = PLAN_ORDER[signal.premium_level] ?? 0;

  if (signalPlanLevel > userPlanLevel) {
    return res.status(403).json({
      ok: false,
      error: 'PLAN_REQUIRED',
      required: signal.premium_level,
      current: req.user.plan,
    });
  }

  return res.json({
    ok: true,
    signal: {
      id: signal.id,
      symbol: signal.symbol,
      direction: signal.direction,
      confidence_score: signal.confidence_score,
      timeframe: signal.timeframe,
      entry: signal.entry,
      stop_loss: signal.stop_loss,
      take_profit_1: signal.take_profit_1,
      take_profit_2: signal.take_profit_2,
      take_profit_3: signal.take_profit_3,
      ai_summary: signal.ai_summary,
      status: signal.status,
      premium_level: signal.premium_level,
      created_at: signal.created_at,
      expires_at: signal.expires_at,
    },
  });
});

module.exports = router;
