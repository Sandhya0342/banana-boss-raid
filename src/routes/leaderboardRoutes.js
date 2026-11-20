/**
 * ============================================================================
 * Banana Boss Raid - Leaderboard Routes
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise
 */

const express = require('express');
const router = express.Router();
const LeaderboardController = require('../controllers/leaderboardController');

router.get('/', LeaderboardController.getLeaderboard);

module.exports = router;
