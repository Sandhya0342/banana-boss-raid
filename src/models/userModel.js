/**
 * ============================================================================
 * Banana Boss Raid - User Model
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise
 * Theme: D. Virtual Identity
 * 
 * ARCHITECTURE EXPLANATION (For Assessment Review):
 * Encapsulates all database interactions for user identities.
 * Uses parameterised SQL queries to prevent SQL Injection attacks.
 * Uses bcryptjs for secure password hashing and verification.
 * ============================================================================
 */

const { db } = require('../config/database');
const bcrypt = require('bcryptjs');

const UserModel = {
  /**
   * Find a user by their unique username (case-insensitive)
   * @param {string} username 
   * @returns {object|null}
   */
  findByUsername(username) {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE');
    return stmt.get(username) || null;
  },

  /**
   * Find a user by their unique email (case-insensitive)
   * @param {string} email 
   * @returns {object|null}
   */
  findByEmail(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE');
    return stmt.get(email) || null;
  },

  /**
   * Find a user by their primary key ID
   * @param {number} id 
   * @returns {object|null}
   */
  findById(id) {
    const stmt = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?');
    return stmt.get(id) || null;
  },

  /**
   * Create a new user and initialize their player statistics in a transaction
   * @param {string} username 
   * @param {string} email 
   * @param {string} plainPassword 
   * @returns {Promise<object>} Created user record (without password)
   */
  async createUser(username, email, plainPassword) {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(plainPassword, saltRounds);

    // Run inside an immediate transaction for data consistency
    db.exec('BEGIN IMMEDIATE;');
    try {
      const userStmt = db.prepare(`
        INSERT INTO users (username, email, password_hash)
        VALUES (?, ?, ?)
      `);
      const userResult = userStmt.run(username.trim(), email.trim().toLowerCase(), passwordHash);
      const newUserId = Number(userResult.lastInsertRowid);

      // Initialize player statistics record
      const statsStmt = db.prepare(`
        INSERT INTO player_stats (user_id, total_score, puzzles_solved, boss_damage)
        VALUES (?, 0, 0, 0)
      `);
      statsStmt.run(newUserId);

      db.exec('COMMIT;');

      return {
        id: newUserId,
        username: username.trim(),
        email: email.trim().toLowerCase()
      };
    } catch (error) {
      db.exec('ROLLBACK;');
      throw error;
    }
  },

  /**
   * Compare a candidate plain-text password with stored hash
   * @param {string} candidatePassword 
   * @param {string} hash 
   * @returns {Promise<boolean>}
   */
  async verifyPassword(candidatePassword, hash) {
    return await bcrypt.compare(candidatePassword, hash);
  }
};

module.exports = UserModel;
