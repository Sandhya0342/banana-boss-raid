/**
 * ============================================================================
 * Banana Boss Raid - Boss Battle Controller
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise
 * Theme: B. Event-Driven Cooperative Boss Battle
 * 
 * ARCHITECTURE EXPLANATION (For Assessment Review):
 * Coordinates the cooperative boss raid.
 * Enforces the rule that a player must solve a puzzle before attacking.
 * Dispatches server-side events on boss attacks and boss defeat.
 * Provides REST polling endpoints for multi-player real-time synchronization.
 * ============================================================================
 */

const BossModel = require('../models/bossModel');
const PlayerModel = require('../models/playerModel');
const BananaApiService = require('../services/bananaApiService');
const { gameEvents, GAME_EVENTS, getRecentActivityFeed } = require('../events/gameEvents');

const BossController = {
  /**
   * Get current boss status, participants and recent raid activity
   */
  getStatus(req, res, next) {
    try {
      const raid = BossModel.getActiveRaid();
      const participants = BossModel.getParticipants(raid.id);
      
      let userCharges = 0;
      let userContribution = null;

      if (req.session && req.session.userId) {
        userCharges = BananaApiService.getAvailableAttackCharges(req.session.userId);
        userContribution = participants.find(p => p.user_id === req.session.userId) || null;
      }

      const healthPercentage = Math.max(0, Math.round((raid.current_health / raid.max_health) * 100));

      return res.json({
        success: true,
        boss: {
          id: raid.id,
          name: raid.boss_name,
          currentHealth: raid.current_health,
          maxHealth: raid.max_health,
          percentage: healthPercentage,
          status: raid.status,
          startedAt: raid.started_at,
          defeatedAt: raid.defeated_at
        },
        participants,
        userCharges,
        userContribution,
        activityFeed: getRecentActivityFeed()
      });
    } catch (error) {
      console.error('[BossController.getStatus] Error:', error);
      next(error);
    }
  },

  /**
   * Execute an attack against the active boss using a solved puzzle charge
   */
  attackBoss(req, res, next) {
    try {
      const userId = req.user.id;
      const username = req.user.username;

      // 1. Check if user has an attack charge (solved puzzle)
      const consumedPuzzleId = BananaApiService.consumeSolvedPuzzleForAttack(userId);
      if (!consumedPuzzleId) {
        return res.status(400).json({
          success: false,
          error: 'No attack charges available! Solve a Banana Puzzle to power up your attack.'
        });
      }

      // 2. Fetch active raid
      const activeRaid = BossModel.getActiveRaid();
      if (activeRaid.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: 'The current boss has already been defeated! Please start a new raid.'
        });
      }

      // 3. Apply atomic damage in transaction
      // Damage calculation: Base 25 damage + optional critical hit bonus
      const isCritical = Math.random() < 0.25; // 25% chance of critical strike
      const damageAmount = isCritical ? 50 : 25;
      const bonusScore = isCritical ? 30 : 15;

      const attackResult = BossModel.applyDamage(activeRaid.id, userId, damageAmount, bonusScore);

      // 4. Emit Events (Theme B: Event-Driven Programming)
      gameEvents.emit(GAME_EVENTS.BOSS_ATTACKED, {
        raidId: activeRaid.id,
        userId,
        username,
        damage: attackResult.damageDealt,
        remainingHealth: attackResult.currentHealth,
        isCritical
      });

      if (attackResult.isDefeated) {
        gameEvents.emit(GAME_EVENTS.BOSS_DEFEATED, {
          raidId: activeRaid.id,
          defeatedBy: username,
          username,
          finalDamage: attackResult.damageDealt
        });
      }

      // 5. Gather fresh player stats
      const freshStats = PlayerModel.getStats(userId);
      const remainingCharges = BananaApiService.getAvailableAttackCharges(userId);
      const participants = BossModel.getParticipants(activeRaid.id);

      return res.json({
        success: true,
        message: isCritical 
          ? `CRITICAL HIT! You blasted the boss for ${attackResult.damageDealt} damage! (+${bonusScore} pts)` 
          : `Direct hit! You dealt ${attackResult.damageDealt} damage to the boss! (+${bonusScore} pts)`,
        damageDealt: attackResult.damageDealt,
        isCritical,
        boss: {
          id: attackResult.raidId,
          name: attackResult.bossName,
          currentHealth: attackResult.currentHealth,
          maxHealth: attackResult.maxHealth,
          percentage: Math.max(0, Math.round((attackResult.currentHealth / attackResult.maxHealth) * 100)),
          isDefeated: attackResult.isDefeated
        },
        participants,
        userCharges: remainingCharges,
        stats: {
          totalScore: freshStats ? freshStats.total_score : 0,
          puzzlesSolved: freshStats ? freshStats.puzzles_solved : 0,
          bossDamage: freshStats ? freshStats.boss_damage : 0
        }
      });
    } catch (error) {
      console.error('[BossController.attackBoss] Error:', error);
      next(error);
    }
  },

  /**
   * Reset / Start a new boss raid after victory
   */
  startNewRaid(req, res, next) {
    try {
      const activeRaid = BossModel.getActiveRaid();
      if (activeRaid.status === 'active' && activeRaid.current_health > 0) {
        return res.status(400).json({
          success: false,
          error: 'The current boss is still active! Defeat it first before starting a new raid.'
        });
      }

      // Alternate boss names for variety
      const bossVariants = [
        { name: 'King Mecha-Banana', hp: 500 },
        { name: 'Cyber Gorilla Overlord', hp: 600 },
        { name: 'Dr. Potassium Prime', hp: 700 }
      ];
      const randomVariant = bossVariants[Math.floor(Math.random() * bossVariants.length)];

      const newRaid = BossModel.startNewRaid(randomVariant.name, randomVariant.hp);

      gameEvents.emit(GAME_EVENTS.BOSS_RESET, {
        newRaidId: newRaid.id,
        bossName: newRaid.boss_name,
        maxHealth: newRaid.max_health
      });

      return res.json({
        success: true,
        message: `A new raid has begun against ${newRaid.boss_name}!`,
        boss: {
          id: newRaid.id,
          name: newRaid.boss_name,
          currentHealth: newRaid.current_health,
          maxHealth: newRaid.max_health,
          percentage: 100,
          status: 'active'
        }
      });
    } catch (error) {
      console.error('[BossController.startNewRaid] Error:', error);
      next(error);
    }
  }
};

module.exports = BossController;
