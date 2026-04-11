const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'moonly.db');

// ─── Module-level db wrapper (set by initDb) ────────────────────────────────
// All routes import `db` from here. The object is populated before
// the Express server starts (see server.js → await initDb()).

const db = {
  _sql: null,   // sql.js Database instance
  _dirty: false,

  /** Mimics better-sqlite3 db.prepare(sql) */
  prepare(sql) {
    return new Statement(this, sql);
  },

  /** Mimics better-sqlite3 db.exec(sql) — runs multi-statement DDL */
  exec(sql) {
    this._sql.run(sql);
    this._persist();
  },

  /** Persist in-memory DB to disk (called after every write) */
  _persist() {
    const data = this._sql.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  },
};

/** Statement wrapper that mirrors better-sqlite3 Statement API */
class Statement {
  constructor(dbWrapper, sql) {
    this._db = dbWrapper;
    this._sql = sql;
  }

  /** Returns first matching row as plain object, or undefined */
  get(...args) {
    const params = flattenParams(args);
    const stmt = this._db._sql.prepare(this._sql);
    try {
      if (params.length) stmt.bind(params);
      if (stmt.step()) {
        return stmt.getAsObject();
      }
      return undefined;
    } finally {
      stmt.free();
    }
  }

  /** Returns all matching rows as array of plain objects */
  all(...args) {
    const params = flattenParams(args);
    const stmt = this._db._sql.prepare(this._sql);
    const rows = [];
    try {
      if (params.length) stmt.bind(params);
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  /** Executes a write statement. Returns { lastInsertRowid, changes } */
  run(...args) {
    const params = flattenParams(args);
    this._db._sql.run(this._sql, params.length ? params : undefined);

    // Read rowid/changes BEFORE persist (export() must not reset connection state,
    // but we read first to be safe)
    let rowid = null;
    let changes = 0;
    try {
      const rowidStmt = this._db._sql.prepare('SELECT last_insert_rowid()');
      if (rowidStmt.step()) { rowid = rowidStmt.get()[0]; }
      rowidStmt.free();
      const changesStmt = this._db._sql.prepare('SELECT changes()');
      if (changesStmt.step()) { changes = changesStmt.get()[0]; }
      changesStmt.free();
    } catch (_) {}

    this._db._persist();

    return {
      lastInsertRowid: typeof rowid === 'bigint' ? Number(rowid) : (rowid ?? null),
      changes: typeof changes === 'bigint' ? Number(changes) : (changes ?? 0),
    };
  }
}

/** Flatten args — supports .get(p1, p2) and .get([p1, p2]) styles */
function flattenParams(args) {
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args;
}

// ─── Schema ────────────────────────────────────────────────────────────────

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id                    INTEGER PRIMARY KEY,
    username              TEXT,
    first_name            TEXT,
    referral_code         TEXT UNIQUE NOT NULL,
    referred_by           INTEGER REFERENCES users(id),
    plan                  TEXT NOT NULL DEFAULT 'FREE',
    plan_expires_at       TEXT,
    notifications_enabled INTEGER NOT NULL DEFAULT 1,
    created_at            TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER NOT NULL REFERENCES users(id),
    referred_id INTEGER NOT NULL REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(referred_id)
  );

  CREATE TABLE IF NOT EXISTS signals (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol           TEXT NOT NULL,
    direction        TEXT NOT NULL,
    confidence_score REAL NOT NULL,
    timeframe        TEXT NOT NULL,
    entry            REAL NOT NULL,
    stop_loss        REAL NOT NULL,
    take_profit_1    REAL NOT NULL,
    take_profit_2    REAL,
    take_profit_3    REAL,
    ai_summary       TEXT,
    status           TEXT NOT NULL DEFAULT 'ACTIVE',
    premium_level    TEXT NOT NULL DEFAULT 'FREE',
    alerted_at       TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at       TEXT
  );

  CREATE TABLE IF NOT EXISTS analysis_snapshots (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    market_sentiment  TEXT NOT NULL,
    fear_greed_index  INTEGER,
    top_opportunities TEXT NOT NULL DEFAULT '[]',
    risk_level        TEXT NOT NULL,
    volatility_note   TEXT,
    ai_insights       TEXT NOT NULL DEFAULT '[]',
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notification_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL REFERENCES users(id),
    signal_id INTEGER REFERENCES signals(id),
    type      TEXT NOT NULL,
    sent_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

// ─── Init (async, called once in server.js before app.listen) ──────────────

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db._sql = new SQL.Database(fileBuffer);
  } else {
    db._sql = new SQL.Database();
  }

  // Run schema (CREATE TABLE IF NOT EXISTS — safe to run every startup)
  db._sql.run(SCHEMA);
  db._persist();

  console.log('[db] SQLite initialized:', DB_PATH);
  return db;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const PLAN_ORDER = { FREE: 0, PRO: 1, LUXE: 2 };

function planAllows(userPlan, requiredPlan) {
  return (PLAN_ORDER[userPlan] ?? 0) >= (PLAN_ORDER[requiredPlan] ?? 0);
}

function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'MOON-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function upsertUser({ id, username, first_name, referred_by_code }) {
  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

  if (!user) {
    let referralCode;
    do {
      referralCode = generateReferralCode();
    } while (db.prepare('SELECT 1 FROM users WHERE referral_code = ?').get(referralCode));

    db.prepare(`
      INSERT INTO users (id, username, first_name, referral_code)
      VALUES (?, ?, ?, ?)
    `).run(id, username || null, first_name || null, referralCode);

    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

    if (referred_by_code) {
      const referrer = db.prepare('SELECT * FROM users WHERE referral_code = ?').get(referred_by_code);
      if (referrer && referrer.id !== id) {
        db.prepare(`INSERT OR IGNORE INTO referrals (referrer_id, referred_id) VALUES (?, ?)`)
          .run(referrer.id, id);
        db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(referrer.id, id);
      }
    }
  } else {
    db.prepare('UPDATE users SET username = ?, first_name = ? WHERE id = ?')
      .run(username || null, first_name || null, id);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  return user;
}

function checkPlanExpiry(user) {
  if (user.plan !== 'FREE' && user.plan_expires_at) {
    if (new Date(user.plan_expires_at) < new Date()) {
      db.prepare(`UPDATE users SET plan = 'FREE', plan_expires_at = NULL WHERE id = ?`).run(user.id);
      return db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    }
  }
  return user;
}

module.exports = {
  db,
  initDb,
  PLAN_ORDER,
  planAllows,
  generateReferralCode,
  upsertUser,
  checkPlanExpiry,
};
