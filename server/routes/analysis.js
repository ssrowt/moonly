const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { validateTelegramInitData, requirePlan } = require('../middleware/auth');

/**
 * GET /api/analysis
 *
 * Returns the latest AI market analysis snapshot.
 * Requires PRO or LUXE plan.
 */
router.get('/', validateTelegramInitData, requirePlan('PRO'), (req, res) => {
  const snapshot = db.prepare(`
    SELECT * FROM analysis_snapshots
    ORDER BY created_at DESC
    LIMIT 1
  `).get();

  if (!snapshot) {
    return res.status(404).json({ ok: false, error: 'No analysis available yet' });
  }

  let top_opportunities = [];
  let ai_insights = [];

  try { top_opportunities = JSON.parse(snapshot.top_opportunities); } catch {}
  try { ai_insights = JSON.parse(snapshot.ai_insights); } catch {}

  return res.json({
    ok: true,
    analysis: {
      id: snapshot.id,
      market_sentiment: snapshot.market_sentiment,
      fear_greed_index: snapshot.fear_greed_index,
      top_opportunities,
      risk_level: snapshot.risk_level,
      volatility_note: snapshot.volatility_note,
      ai_insights,
      created_at: snapshot.created_at,
    },
  });
});

module.exports = router;
