require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');

async function start() {
  // ─── Database (must init before routes are used) ───────────────────────────
  await initDb();

  // ─── Telegram Bot ──────────────────────────────────────────────────────────
  const { initBot, getBot } = require('./bot/index');
  const bot = initBot();

  // ─── Cron jobs ─────────────────────────────────────────────────────────────
  const { startSubscriptionCheckCron } = require('./cron/subscriptionCheck');
  startSubscriptionCheckCron();

  // ─── Express app ───────────────────────────────────────────────────────────
  const app = express();

  app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Telegram-Init-Data', 'X-Admin-Key'],
  }));

  // Telegram webhook must be registered before express.json()
  if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_URL && bot) {
    app.post('/webhook', express.raw({ type: '*/*' }), (req, res) => {
      bot.processUpdate(JSON.parse(req.body));
      res.sendStatus(200);
    });
  }

  app.use(express.json());

  // ─── Routes ────────────────────────────────────────────────────────────────
  app.use('/api/auth',         require('./routes/auth'));
  app.use('/api/signals',      require('./routes/signals'));
  app.use('/api/analysis',     require('./routes/analysis'));
  app.use('/api/profile',      require('./routes/profile'));
  app.use('/api/subscription', require('./routes/subscriptions'));
  app.use('/api/admin',        require('./routes/admin'));
  app.use('/api/market',       require('./routes/market'));

  // ─── Health check ──────────────────────────────────────────────────────────
  app.get('/health', (req, res) => {
    res.json({
      ok: true,
      service: 'moonly-server',
      bot: bot ? 'running' : 'disabled',
      env: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    });
  });

  // ─── 404 ───────────────────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).json({ ok: false, error: `Route not found: ${req.method} ${req.path}` });
  });

  // ─── Error handler ─────────────────────────────────────────────────────────
  app.use((err, req, res, next) => {
    console.error('[server] Unhandled error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  });

  // ─── Start ─────────────────────────────────────────────────────────────────
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🌙 Moonly server running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Env:    ${process.env.NODE_ENV || 'development'}\n`);
  });
}

start().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
