/**
 * ============================================================================
 * Banana Boss Raid - Player Model
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise
 * Theme: D. Virtual Identity & Leaderboard
 * 
 * ARCHITECTURE EXPLANATION (For Assessment Review):
 * Encapsulates player progress tracking, scoring, and leaderboard queries.
 * Queries are strictly parameterised to maintain data security.
 * ============================================================================
 */

const { db } = require('../config/database');

const PlayerModel = {
  /**
   * Get player statistics by user ID
   * @param {number} userId 
   * @returns {object}
   */
  getStats(userId) {
    const stmt = db.prepare(`
      SELECT 
        u.id AS user_id,
        u.username,
        u.email,
        u.created_at AS member_since,
        COALESCE(ps.total_score, 0) AS total_score,
        COALESCE(ps.puzzles_solved, 0) AS puzzles_solved,
        COALESCE(ps.boss_damage, 0) AS boss_damage,
        ps.last_active
      FROM users u
      LEFT JOIN player_stats ps ON u.id = ps.user_id
      WHERE u.id = ?
    `);
    return stmt.get(userId) || null;
  },

  /**
   * Increment puzzles solved count and add points
   * @param {number} userId 
   * @param {number} points 
   */
  recordPuzzleSolve(userId, points = 10) {
    const stmt = db.prepare(`
      UPDATE player_stats
      SET 
        total_score = total_score + ?,
        puzzles_solved = puzzles_solved + 1,
        last_active = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `);
    return stmt.run(points, userId);
  },

  /**
   * Record boss damage and add reward points
   * @param {number} userId 
   * @param {number} damage 
   * @param {number} bonusPoints 
   */
  recordBossDamage(userId, damage, bonusPoints = 5) {
    const stmt = db.prepare(`
      UPDATE player_stats
      SET 
        total_score = total_score + ?,
        boss_damage = boss_damage + ?,
        last_active = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `);
    return stmt.run(bonusPoints, damage, userId);
  },

  /**
   * Fetch leaderboard sorted by total score descending
   * @param {number} limit 
   * @returns {Array<object>}
   */
  getLeaderboard(limit = 20) {
    const stmt = db.prepare(`
      SELECT 
        u.id AS user_id,
        u.username,
        ps.total_score,
        ps.puzzles_solved,
        ps.boss_damage,
        ps.last_active
      FROM player_stats ps
      JOIN users u ON ps.user_id = u.id
      ORDER BY ps.total_score DESC, ps.boss_damage DESC, ps.puzzles_solved DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }
};

module.exports = PlayerModel;
