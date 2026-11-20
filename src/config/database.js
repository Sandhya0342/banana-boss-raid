/**
 * ============================================================================
 * Banana Boss Raid - Database Configuration and Session Store
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise (University of Bedfordshire)
 * Technology: Node.js Built-in SQLite (node:sqlite)
 * 
 * ARCHITECTURE EXPLANATION (For Assessment Review):
 * This module configures a persistent SQLite database for the application.
 * In modern Node.js (v22.5.0+), the 'node:sqlite' DatabaseSync module is built-in.
 * It provides high performance, zero external C++ dependencies, and full ACID
 * compliance.
 * 
 * Features implemented:
 * 1. Write-Ahead Logging (WAL) for safe concurrent reads and writes.
 * 2. Foreign Key constraints enforcement (PRAGMA foreign_keys = ON).
 * 3. Complete schema creation for users, player stats, boss raids, raid participants,
 *    puzzle sessions, and persistent web sessions.
 * 4. Custom SqliteSessionStore conforming to the express-session Store API.
 * ============================================================================
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const session = require('express-session');

// Resolve database path from environment variable or fallback to default
const dbPath = process.env.DATABASE_FILE || path.join(__dirname, '../../database/banana_boss.db');
const dbDir = path.dirname(dbPath);

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Open or create SQLite database connection
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrency and foreign keys for referential integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Initialize all database tables and indexes
 */
function initDatabase() {
  db.exec(`
    -- 1. Users Table (Theme D: Virtual Identity)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Player Statistics Table
    CREATE TABLE IF NOT EXISTS player_stats (
      user_id INTEGER PRIMARY KEY,
      total_score INTEGER DEFAULT 0,
      puzzles_solved INTEGER DEFAULT 0,
      boss_damage INTEGER DEFAULT 0,
      last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 3. Boss Raids Table (Theme B: Event-Driven Boss Battles)
    CREATE TABLE IF NOT EXISTS boss_raids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      boss_name TEXT NOT NULL,
      current_health INTEGER NOT NULL,
      max_health INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('active', 'defeated')),
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      defeated_at DATETIME
    );

    -- 4. Raid Participants Table (Cooperative contributions)
    CREATE TABLE IF NOT EXISTS raid_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raid_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      damage_dealt INTEGER DEFAULT 0,
      attacks_count INTEGER DEFAULT 0,
      last_attack_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (raid_id) REFERENCES boss_raids(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(raid_id, user_id)
    );

    -- 5. Puzzle Sessions Table (Theme C: Interoperability & Server-side validation)
    CREATE TABLE IF NOT EXISTS puzzle_sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      solution INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'solved', 'failed', 'used_in_attack')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      solved_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 6. Sessions Table (Persistent SQLite session store)
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired_at INTEGER NOT NULL
    );

    -- Indexes for fast query performance
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_player_stats_score ON player_stats(total_score DESC);
    CREATE INDEX IF NOT EXISTS idx_boss_raids_status ON boss_raids(status);
    CREATE INDEX IF NOT EXISTS idx_puzzle_sessions_user ON puzzle_sessions(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired_at);
  `);

  // Ensure at least one active boss raid exists on startup
  const activeRaid = db.prepare("SELECT id FROM boss_raids WHERE status = 'active' ORDER BY id DESC LIMIT 1").get();
  if (!activeRaid) {
    db.prepare(`
      INSERT INTO boss_raids (boss_name, current_health, max_health, status)
      VALUES (?, ?, ?, 'active')
    `).run('King Mecha-Banana', 500, 500);
  }
}

// Run schema initialization
initDatabase();

/**
 * Custom Persistent SQLite Session Store for express-session
 * Allows user sessions to survive server restarts.
 */
class SqliteSessionStore extends session.Store {
  constructor(databaseInstance) {
    super();
    this.db = databaseInstance;

    // Periodically remove expired sessions every 15 minutes
    this.cleanupTimer = setInterval(() => {
      try {
        const now = Date.now();
        this.db.prepare('DELETE FROM sessions WHERE expired_at < ?').run(now);
      } catch (err) {
        console.error('[SessionStore] Expired session cleanup error:', err.message);
      }
    }, 15 * 60 * 1000);

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  get(sid, callback) {
    try {
      const now = Date.now();
      const row = this.db.prepare('SELECT sess, expired_at FROM sessions WHERE sid = ?').get(sid);
      if (!row) {
        return callback(null, null);
      }
      if (row.expired_at < now) {
        this.destroy(sid, () => {});
        return callback(null, null);
      }
      const sessData = JSON.parse(row.sess);
      return callback(null, sessData);
    } catch (err) {
      return callback(err);
    }
  }

  set(sid, sessionData, callback) {
    try {
      const maxAge = sessionData.cookie && sessionData.cookie.maxAge ? sessionData.cookie.maxAge : 24 * 60 * 60 * 1000;
      const expiredAt = Date.now() + maxAge;
      const sessStr = JSON.stringify(sessionData);

      this.db.prepare(`
        INSERT INTO sessions (sid, sess, expired_at)
        VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expired_at = excluded.expired_at
      `).run(sid, sessStr, expiredAt);

      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  touch(sid, sessionData, callback) {
    try {
      const maxAge = sessionData.cookie && sessionData.cookie.maxAge ? sessionData.cookie.maxAge : 24 * 60 * 60 * 1000;
      const expiredAt = Date.now() + maxAge;
      this.db.prepare('UPDATE sessions SET expired_at = ? WHERE sid = ?').run(expiredAt, sid);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }
}

module.exports = {
  db,
  initDatabase,
  SqliteSessionStore
};
