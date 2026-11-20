/**
 * ============================================================================
 * Banana Boss Raid - Leaderboard Controller
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise
 * Theme: D. Virtual Identity & Player Competition
 * 
 * ARCHITECTURE EXPLANATION (For Assessment Review):
 * Fetches ranked player statistics sorted by total score, boss damage,
 * and puzzles solved. Publicly accessible to authenticated and guest players.
 * ============================================================================
 */

const PlayerModel = require('../models/playerModel');

const LeaderboardController = {
  /**
   * Fetch top player rankings
   */
  getLeaderboard(req, res, next) {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
      const rankings = PlayerModel.getLeaderboard(limit);

      return res.json({
        success: true,
        count: rankings.length,
        leaderboard: rankings
      });
    } catch (error) {
      console.error('[LeaderboardController.getLeaderboard] Error:', error);
      next(error);
    }
  }
};

module.exports = LeaderboardController;
