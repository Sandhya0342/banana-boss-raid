/**
 * ============================================================================
 * Banana Boss Raid - Puzzle Controller
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise
 * Theme: C. Interoperability & B. Event-Driven Programming
 * 
 * ARCHITECTURE EXPLANATION (For Assessment Review):
 * Handles puzzle generation requests and answer verification.
 * Enforces server-side validation and guarantees that puzzle solutions
 * are NEVER returned to the client browser.
 * ============================================================================
 */

const BananaApiService = require('../services/bananaApiService');
const PlayerModel = require('../models/playerModel');
const { gameEvents, GAME_EVENTS } = require('../events/gameEvents');

const PuzzleController = {
  /**
   * Request a new puzzle for the authenticated user
   */
  async getPuzzle(req, res, next) {
    try {
      const userId = req.user.id;
      const puzzle = await BananaApiService.createPuzzleForUser(userId);

      // Emit event
      gameEvents.emit(GAME_EVENTS.PUZZLE_REQUESTED, {
        userId,
        puzzleId: puzzle.puzzleId
      });

      return res.json({
        success: true,
        puzzleId: puzzle.puzzleId,
        question: puzzle.question,
        source: puzzle.source
      });
    } catch (error) {
      console.error('[PuzzleController.getPuzzle] Error:', error);
      next(error);
    }
  },

  /**
   * Submit an answer for server-side evaluation
   */
  submitAnswer(req, res, next) {
    try {
      const userId = req.user.id;
      const { puzzleId, answer } = req.body;

      if (!puzzleId || answer === undefined || answer === null || String(answer).trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Puzzle ID and answer are required.'
        });
      }

      // Validate on server
      const result = BananaApiService.validateAnswer(puzzleId, userId, answer);

      if (!result.success) {
        return res.status(400).json(result);
      }

      if (result.correct) {
        // Award points and record stats
        PlayerModel.recordPuzzleSolve(userId, result.pointsAwarded);

        // Emit puzzle solved event
        gameEvents.emit(GAME_EVENTS.PUZZLE_SOLVED, {
          userId,
          username: req.user.username,
          puzzleId,
          scoreEarned: result.pointsAwarded
        });
      } else {
        // Emit puzzle failed event
        gameEvents.emit(GAME_EVENTS.PUZZLE_FAILED, {
          userId,
          username: req.user.username,
          puzzleId,
          submittedAnswer: answer
        });
      }

      // Fetch fresh stats to return to frontend
      const freshStats = PlayerModel.getStats(userId);
      const attackCharges = BananaApiService.getAvailableAttackCharges(userId);

      return res.json({
        success: true,
        correct: result.correct,
        message: result.message,
        pointsAwarded: result.pointsAwarded,
        stats: {
          totalScore: freshStats ? freshStats.total_score : 0,
          puzzlesSolved: freshStats ? freshStats.puzzles_solved : 0,
          bossDamage: freshStats ? freshStats.boss_damage : 0,
          attackCharges: attackCharges
        }
      });
    } catch (error) {
      console.error('[PuzzleController.submitAnswer] Error:', error);
      next(error);
    }
  }
};

module.exports = PuzzleController;
