/**
 * ============================================================================
 * Banana Boss Raid - Puzzle Routes
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise
 * Theme: C. Interoperability & Server Validation
 */

const express = require('express');
const router = express.Router();
const PuzzleController = require('../controllers/puzzleController');
const { requireAuth } = require('../middleware/authMiddleware');

// All puzzle routes require active session authentication
router.use(requireAuth);

router.get('/new', PuzzleController.getPuzzle);
router.post('/submit', PuzzleController.submitAnswer);

module.exports = router;
