/**
 * ============================================================================
 * Banana Boss Raid - Banana API Interoperability Service
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise (University of Bedfordshire)
 * Theme: C. Interoperability & External API Integration
 * 
 * OFFICIAL DOCUMENTATION REFERENCE:
 * - Documentation: https://marcconrad.com/uob/banana/doc.php
 * - Endpoint: https://marcconrad.com/uob/banana/api.php
 * - Output format: JSON (?out=json)
 * - Response structure: { "question": "<image_url>", "solution": <number> }
 * 
 * SECURITY & ARCHITECTURE DECISIONS (For Assessment Review):
 * 1. The external API is called strictly from this server-side service, never
 *    directly from the browser.
 * 2. The solution received from the Banana API is stored securely in SQLite
 *    and NEVER exposed to the frontend/browser.
 * 3. Timeouts (AbortController) and network failures are handled gracefully.
 * 4. A high-quality procedural fallback generator is included to ensure game
 *    continuity even if the university server experiences temporary downtime.
 * ============================================================================
 */

const crypto = require('node:crypto');
const { db } = require('../config/database');

const BANANA_API_URL = process.env.BANANA_API_URL || 'https://marcconrad.com/uob/banana/api.php';
const API_TIMEOUT_MS = parseInt(process.env.BANANA_API_TIMEOUT, 10) || 7000;

/**
 * Generate a standalone fallback SVG puzzle in case the external API is unreachable
 * This ensures the assignment remains fully testable offline or during API maintenance.
 * @returns {{ question: string, solution: number, source: string }}
 */
function generateFallbackPuzzle() {
  const a = Math.floor(Math.random() * 5) + 1; // 1 to 5
  const b = Math.floor(Math.random() * 4) + 1; // 1 to 4
  const sum = a + b;
  const solution = b; // User must solve for the missing banana bundle

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="180" viewBox="0 0 400 180">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2a0845"/>
          <stop offset="100%" stop-color="#180026"/>
        </linearGradient>
      </defs>
      <rect width="400" height="180" rx="14" fill="url(#bg)" stroke="#ffd700" stroke-width="3"/>
      <text x="200" y="32" font-family="'Segoe UI', Arial, sans-serif" font-size="16" fill="#ffd700" font-weight="bold" text-anchor="middle">
        🍌 BANANA MATH PUZZLE (OFFLINE FALLBACK) 🍌
      </text>
      <text x="200" y="85" font-family="'Segoe UI', Arial, sans-serif" font-size="28" fill="#ffffff" font-weight="bold" text-anchor="middle">
        ${a} + 🍌 = ${sum}
      </text>
      <text x="200" y="130" font-family="'Segoe UI', Arial, sans-serif" font-size="18" fill="#ffe57f" text-anchor="middle">
        What is the value of 🍌?
      </text>
      <text x="200" y="160" font-family="'Segoe UI', Arial, sans-serif" font-size="12" fill="#aaaaaa" text-anchor="middle">
        Enter a single number (0-9)
      </text>
    </svg>
  `.trim();

  const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  return {
    question: dataUri,
    solution,
    source: 'offline_fallback'
  };
}

/**
 * Fetch a new puzzle from the official Banana API with timeout and fallback
 * @returns {Promise<{ question: string, solution: number, source: string }>}
 */
async function fetchFromOfficialApi() {
  const url = `${BANANA_API_URL}?out=json`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BananaBossRaid-UniversityBedfordshire/1.0'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Banana API returned HTTP status ${response.status}`);
    }

    const data = await response.json();

    if (!data || typeof data.question !== 'string' || data.solution === undefined) {
      throw new Error('Banana API returned malformed or unexpected JSON structure');
    }

    const solutionNum = parseInt(data.solution, 10);
    if (isNaN(solutionNum)) {
      throw new Error(`Banana API solution is not a valid number: ${data.solution}`);
    }

    return {
      question: data.question,
      solution: solutionNum,
      source: 'official_banana_api'
    };
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn(`[BananaApiService] Official API fetch error: ${error.message}. Activating graceful fallback.`);
    return generateFallbackPuzzle();
  }
}

const BananaApiService = {
  /**
   * Request a new puzzle, store the solution securely on the server,
   * and return ONLY the puzzle ID and image to the client.
   * @param {number} userId 
   * @returns {Promise<{ puzzleId: string, question: string, source: string }>}
   */
  async createPuzzleForUser(userId) {
    const puzzleData = await fetchFromOfficialApi();
    const puzzleId = crypto.randomUUID();

    // Store puzzle session in SQLite
    const stmt = db.prepare(`
      INSERT INTO puzzle_sessions (id, user_id, image_url, solution, status)
      VALUES (?, ?, ?, ?, 'pending')
    `);
    stmt.run(puzzleId, userId, puzzleData.question, puzzleData.solution);

    // CRITICAL SECURITY: Never return puzzleData.solution to client!
    return {
      puzzleId,
      question: puzzleData.question,
      source: puzzleData.source
    };
  },

  /**
   * Validate a player's submitted answer on the server
   * @param {string} puzzleId 
   * @param {number} userId 
   * @param {number|string} submittedAnswer 
   * @returns {{ correct: boolean, pointsAwarded: number, message: string }}
   */
  validateAnswer(puzzleId, userId, submittedAnswer) {
    const puzzle = db.prepare(`
      SELECT id, user_id, solution, status
      FROM puzzle_sessions
      WHERE id = ? AND user_id = ?
    `).get(puzzleId, userId);

    if (!puzzle) {
      return {
        success: false,
        correct: false,
        pointsAwarded: 0,
        message: 'Puzzle session not found or does not belong to you.'
      };
    }

    if (puzzle.status !== 'pending') {
      return {
        success: false,
        correct: false,
        pointsAwarded: 0,
        message: `This puzzle has already been submitted (Status: ${puzzle.status}). Please request a new puzzle.`
      };
    }

    const parsedAnswer = parseInt(submittedAnswer, 10);
    if (isNaN(parsedAnswer)) {
      return {
        success: false,
        correct: false,
        pointsAwarded: 0,
        message: 'Please provide a valid numeric answer.'
      };
    }

    const isCorrect = parsedAnswer === puzzle.solution;

    if (isCorrect) {
      // Mark as solved
      db.prepare(`
        UPDATE puzzle_sessions
        SET status = 'solved', solved_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(puzzleId);

      return {
        success: true,
        correct: true,
        pointsAwarded: 10,
        message: 'Correct! You earned 10 points and unlocked an attack on King Mecha-Banana!'
      };
    } else {
      // Mark as failed
      db.prepare(`
        UPDATE puzzle_sessions
        SET status = 'failed', solved_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(puzzleId);

      return {
        success: true,
        correct: false,
        pointsAwarded: 0,
        message: 'Incorrect answer. Try your skill on the next puzzle!'
      };
    }
  },

  /**
   * Consume a solved puzzle to authorise an attack on the boss
   * @param {number} userId 
   * @returns {string|null} Puzzle ID that was consumed, or null if none available
   */
  consumeSolvedPuzzleForAttack(userId) {
    db.exec('BEGIN IMMEDIATE;');
    try {
      const eligiblePuzzle = db.prepare(`
        SELECT id FROM puzzle_sessions
        WHERE user_id = ? AND status = 'solved'
        ORDER BY solved_at ASC
        LIMIT 1
      `).get(userId);

      if (!eligiblePuzzle) {
        db.exec('COMMIT;');
        return null;
      }

      db.prepare(`
        UPDATE puzzle_sessions
        SET status = 'used_in_attack'
        WHERE id = ?
      `).run(eligiblePuzzle.id);

      db.exec('COMMIT;');
      return eligiblePuzzle.id;
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  },

  /**
   * Count available attack charges (solved puzzles not yet used)
   * @param {number} userId 
   * @returns {number}
   */
  getAvailableAttackCharges(userId) {
    const row = db.prepare(`
      SELECT COUNT(*) AS count
      FROM puzzle_sessions
      WHERE user_id = ? AND status = 'solved'
    `).get(userId);

    return row ? row.count : 0;
  }
};

module.exports = BananaApiService;
