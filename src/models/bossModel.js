/**
 * ============================================================================
 * Banana Boss Raid - Boss Model
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise
 * Theme: B. Event-Driven Cooperative Boss Battle
 * 
 * ARCHITECTURE EXPLANATION (For Assessment Review):
 * Handles the cooperative boss battle state and transactions.
 * Concurrent attack race conditions are prevented using SQLite IMMEDIATE transactions,
 * ensuring atomic state updates and consistent health calculations.
 * ============================================================================
 */

const { db } = require('../config/database');

const BossModel = {
  /**
   * Get the current active raid or create a default one if none exists
   * @returns {object} Current active raid details
   */
  getActiveRaid() {
    let raid = db.prepare(`
      SELECT id, boss_name, current_health, max_health, status, started_at, defeated_at
      FROM boss_raids
      WHERE status = 'active'
      ORDER BY id DESC
      LIMIT 1
    `).get();

    if (!raid) {
      // Automatically spawn a new boss raid if none is active
      const stmt = db.prepare(`
        INSERT INTO boss_raids (boss_name, current_health, max_health, status)
        VALUES (?, ?, ?, 'active')
      `);
      const result = stmt.run('King Mecha-Banana', 500, 500);
      raid = {
        id: Number(result.lastInsertRowid),
        boss_name: 'King Mecha-Banana',
        current_health: 500,
        max_health: 500,
        status: 'active',
        started_at: new Date().toISOString(),
        defeated_at: null
      };
    }

    return raid;
  },

  /**
   * Fetch top contributors for a raid
   * @param {number} raidId 
   * @returns {Array<object>}
   */
  getParticipants(raidId) {
    const stmt = db.prepare(`
      SELECT 
        rp.user_id,
        u.username,
        rp.damage_dealt,
        rp.attacks_count,
        rp.last_attack_at
      FROM raid_participants rp
      JOIN users u ON rp.user_id = u.id
      WHERE rp.raid_id = ?
      ORDER BY rp.damage_dealt DESC, rp.last_attack_at ASC
    `);
    return stmt.all(raidId);
  },

  /**
   * Apply atomic damage to the boss within a transaction to prevent race conditions
   * @param {number} raidId 
   * @param {number} userId 
   * @param {number} damageAmount 
   * @param {number} bonusPoints 
   * @returns {object} Result of the attack
   */
  applyDamage(raidId, userId, damageAmount = 25, bonusPoints = 20) {
    db.exec('BEGIN IMMEDIATE;');
    try {
      // Fetch latest boss state with lock
      const raid = db.prepare(`
        SELECT id, boss_name, current_health, max_health, status
        FROM boss_raids
        WHERE id = ?
      `).get(raidId);

      if (!raid) {
        throw new Error('Boss raid not found.');
      }

      if (raid.status !== 'active') {
        throw new Error('This boss has already been defeated! Please start a new raid.');
      }

      const actualDamage = Math.min(raid.current_health, damageAmount);
      const newHealth = Math.max(0, raid.current_health - actualDamage);
      const isDefeated = newHealth === 0;

      // Update boss health and status
      if (isDefeated) {
        db.prepare(`
          UPDATE boss_raids
          SET current_health = 0, status = 'defeated', defeated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(raidId);
      } else {
        db.prepare(`
          UPDATE boss_raids
          SET current_health = ?
          WHERE id = ?
        `).run(newHealth, raidId);
      }

      // Record or update participant contributions
      db.prepare(`
        INSERT INTO raid_participants (raid_id, user_id, damage_dealt, attacks_count, last_attack_at)
        VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(raid_id, user_id) DO UPDATE SET
          damage_dealt = damage_dealt + excluded.damage_dealt,
          attacks_count = attacks_count + 1,
          last_attack_at = CURRENT_TIMESTAMP
      `).run(raidId, userId, actualDamage);

      // Award player score and update total boss damage
      db.prepare(`
        UPDATE player_stats
        SET 
          total_score = total_score + ?,
          boss_damage = boss_damage + ?,
          last_active = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(bonusPoints, actualDamage, userId);

      db.exec('COMMIT;');

      return {
        raidId,
        bossName: raid.boss_name,
        damageDealt: actualDamage,
        currentHealth: newHealth,
        maxHealth: raid.max_health,
        isDefeated
      };
    } catch (error) {
      db.exec('ROLLBACK;');
      throw error;
    }
  },

  /**
   * Spawn a new raid (resetting the boss battle)
   * @param {string} bossName 
   * @param {number} maxHealth 
   * @returns {object}
   */
  startNewRaid(bossName = 'Mega Mecha-Banana', maxHealth = 600) {
    db.exec('BEGIN IMMEDIATE;');
    try {
      // Mark any leftover active raids as defeated/archived
      db.prepare(`
        UPDATE boss_raids
        SET status = 'defeated', defeated_at = CURRENT_TIMESTAMP
        WHERE status = 'active'
      `).run();

      const stmt = db.prepare(`
        INSERT INTO boss_raids (boss_name, current_health, max_health, status)
        VALUES (?, ?, ?, 'active')
      `);
      const result = stmt.run(bossName, maxHealth, maxHealth);
      const newRaidId = Number(result.lastInsertRowid);

      db.exec('COMMIT;');

      return {
        id: newRaidId,
        boss_name: bossName,
        current_health: maxHealth,
        max_health: maxHealth,
        status: 'active',
        started_at: new Date().toISOString()
      };
    } catch (error) {
      db.exec('ROLLBACK;');
      throw error;
    }
  }
};

module.exports = BossModel;
