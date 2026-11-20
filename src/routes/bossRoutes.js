/**
 * ============================================================================
 * Banana Boss Raid - Boss Battle Routes
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise
 * Theme: B. Event-Driven Cooperative Boss Battle
 */

const express = require('express');
const router = express.Router();
const BossController = require('../controllers/bossController');
const { requireAuth } = require('../middleware/authMiddleware');

// Public raid state polling (allows guest visitors to observe the battle)
router.get('/status', BossController.getStatus);

// Protected actions: attacking and starting a new raid
router.post('/attack', requireAuth, BossController.attackBoss);
router.post('/reset', requireAuth, BossController.startNewRaid);

module.exports = router;
