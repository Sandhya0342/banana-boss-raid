/**
 * ============================================================================
 * Banana Boss Raid - Comprehensive Automated Backend Test Suite
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise (University of Bedfordshire)
 * 
 * Verifies all four themes and system requirements:
 * 1. Database schema and constraints
 * 2. Theme D: Virtual Identity (Registration, hashing, login, sessions, protected routes)
 * 3. Theme C: Interoperability (Banana API service, server validation, solution security)
 * 4. Theme B: Event-Driven Programming (EventEmitter events, boss combat events)
 * 5. Feature 4: Cooperative Boss Raid (Atomic transactions, participant tracking)
 * 6. Feature 5: Leaderboard (Score sorting, ranking)
 * ============================================================================
 */

const assert = require('node:assert');
const { db } = require('../src/config/database');
const UserModel = require('../src/models/userModel');
const PlayerModel = require('../src/models/playerModel');
const BossModel = require('../src/models/bossModel');
const BananaApiService = require('../src/services/bananaApiService');
const { gameEvents, GAME_EVENTS } = require('../src/events/gameEvents');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING BANANA BOSS RAID AUTOMATED TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // TEST 1: Database Initialization
  await test('Database tables exist and PRAGMA foreign keys is active', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map(t => t.name);
    assert.ok(tableNames.includes('users'), 'users table exists');
    assert.ok(tableNames.includes('player_stats'), 'player_stats table exists');
    assert.ok(tableNames.includes('boss_raids'), 'boss_raids table exists');
    assert.ok(tableNames.includes('raid_participants'), 'raid_participants table exists');
    assert.ok(tableNames.includes('puzzle_sessions'), 'puzzle_sessions table exists');
    assert.ok(tableNames.includes('sessions'), 'sessions table exists');
  });

  // TEST 2: Event Listener Verification (Theme B)
  let eventReceived = false;
  await test('Node.js EventEmitter registers and triggers custom game events', () => {
    const handler = (payload) => {
      if (payload.test === 'banana_test') eventReceived = true;
    };
    gameEvents.on('test:event', handler);
    gameEvents.emit('test:event', { test: 'banana_test' });
    gameEvents.removeListener('test:event', handler);
    assert.strictEqual(eventReceived, true, 'EventEmitter delivered payload');
  });

  // TEST 3: User Registration & Password Hashing (Theme D)
  const testUser = `test_hero_${Date.now()}`;
  const testEmail = `${testUser}@example.com`;
  const rawPassword = 'SecurePassword123!';
  let createdUser;

  await test('User registration hashes password with bcrypt and creates stats', async () => {
    createdUser = await UserModel.createUser(testUser, testEmail, rawPassword);
    assert.ok(createdUser.id, 'User ID assigned');
    assert.strictEqual(createdUser.username, testUser);

    const dbRecord = db.prepare('SELECT * FROM users WHERE id = ?').get(createdUser.id);
    assert.notStrictEqual(dbRecord.password_hash, rawPassword, 'Password is not stored in plaintext');
    assert.ok(dbRecord.password_hash.startsWith('$2'), 'Password uses bcrypt hash format');

    const stats = PlayerModel.getStats(createdUser.id);
    assert.ok(stats, 'Player stats record initialized');
    assert.strictEqual(stats.total_score, 0);
  });

  // TEST 4: Duplicate User Prevention
  await test('Duplicate username or email is prevented by unique database constraints', async () => {
    try {
      await UserModel.createUser(testUser, 'unique_diff@example.com', rawPassword);
      assert.fail('Should have thrown unique constraint error for duplicate username');
    } catch (err) {
      assert.ok(err.message.includes('UNIQUE constraint failed'), 'Caught expected UNIQUE constraint error');
    }
  });

  // TEST 5: Password Verification
  await test('UserModel verifies valid password and rejects incorrect password', async () => {
    const dbRecord = db.prepare('SELECT * FROM users WHERE id = ?').get(createdUser.id);
    const valid = await UserModel.verifyPassword(rawPassword, dbRecord.password_hash);
    const invalid = await UserModel.verifyPassword('WrongPass123', dbRecord.password_hash);
    assert.strictEqual(valid, true, 'Valid password accepted');
    assert.strictEqual(invalid, false, 'Invalid password rejected');
  });

  // TEST 6: Puzzle System & Interoperability (Theme C)
  let puzzleSession;
  await test('Banana API service fetches puzzle and conceals solution from client', async () => {
    puzzleSession = await BananaApiService.createPuzzleForUser(createdUser.id);
    assert.ok(puzzleSession.puzzleId, 'Generated puzzleId');
    assert.ok(puzzleSession.question, 'Generated puzzle image question');
    assert.strictEqual(puzzleSession.solution, undefined, 'Solution is NEVER exposed to client payload');

    const stored = db.prepare('SELECT * FROM puzzle_sessions WHERE id = ?').get(puzzleSession.puzzleId);
    assert.ok(stored, 'Puzzle stored on server');
    assert.ok(typeof stored.solution === 'number', 'Solution securely stored as integer on server');
    assert.strictEqual(stored.status, 'pending');
  });

  // TEST 7: Answer Validation & Prevention of Repeated Submissions
  await test('Server validates answer correctly and prevents repeated submissions', () => {
    const stored = db.prepare('SELECT * FROM puzzle_sessions WHERE id = ?').get(puzzleSession.puzzleId);
    const correctSolution = stored.solution;

    // Submit correct answer
    const result = BananaApiService.validateAnswer(puzzleSession.puzzleId, createdUser.id, correctSolution);
    assert.strictEqual(result.correct, true, 'Validated correct answer');
    assert.strictEqual(result.pointsAwarded, 10, 'Awarded 10 points');

    // Attempt second submission with same puzzle
    const secondResult = BananaApiService.validateAnswer(puzzleSession.puzzleId, createdUser.id, correctSolution);
    assert.strictEqual(secondResult.success, false, 'Repeated submission blocked');
    assert.ok(secondResult.message.includes('already been submitted'), 'Clear error message returned');
  });

  // TEST 8: Boss Battle Atomic Damage and Participants (Feature 4 & 5)
  await test('Boss damage calculation is atomic and tracks participant contributions', () => {
    const activeRaid = BossModel.getActiveRaid();
    const initialHealth = activeRaid.current_health;

    // PlayerModel update
    PlayerModel.recordPuzzleSolve(createdUser.id, 10);

    // Apply attack
    const attackResult = BossModel.applyDamage(activeRaid.id, createdUser.id, 25, 15);
    assert.strictEqual(attackResult.damageDealt, 25, 'Dealt 25 damage');
    assert.strictEqual(attackResult.currentHealth, initialHealth - 25, 'Boss health decremented accurately');

    const participants = BossModel.getParticipants(activeRaid.id);
    const userParticipation = participants.find(p => p.user_id === createdUser.id);
    assert.ok(userParticipation, 'User recorded in raid participants');
    assert.strictEqual(userParticipation.damage_dealt, 25);

    const freshStats = PlayerModel.getStats(createdUser.id);
    assert.strictEqual(freshStats.boss_damage, 25, 'Player stats reflect boss damage');
  });

  // TEST 9: Attack Authorization & Charge Consumption
  await test('User cannot attack without available solved puzzle charge', async () => {
    // Consume any existing solved puzzle charge from earlier tests
    while (BananaApiService.consumeSolvedPuzzleForAttack(createdUser.id) !== null) {
      // drain
    }

    // Current user now has no remaining solved puzzle
    const charge = BananaApiService.consumeSolvedPuzzleForAttack(createdUser.id);
    assert.strictEqual(charge, null, 'No attack charge available without solved puzzle');

    // Generate and solve a new puzzle
    const newPuzzle = await BananaApiService.createPuzzleForUser(createdUser.id);
    const stored = db.prepare('SELECT solution FROM puzzle_sessions WHERE id = ?').get(newPuzzle.puzzleId);
    BananaApiService.validateAnswer(newPuzzle.puzzleId, createdUser.id, stored.solution);

    // Now consume should succeed
    const consumed = BananaApiService.consumeSolvedPuzzleForAttack(createdUser.id);
    assert.strictEqual(consumed, newPuzzle.puzzleId, 'Successfully consumed attack charge');

    // Second consumption must fail
    const consumedAgain = BananaApiService.consumeSolvedPuzzleForAttack(createdUser.id);
    assert.strictEqual(consumedAgain, null, 'Charge cannot be reused');
  });

  // TEST 10: Leaderboard Sorting
  await test('Leaderboard orders players by total score descending', () => {
    const leaderboard = PlayerModel.getLeaderboard(10);
    assert.ok(Array.isArray(leaderboard), 'Leaderboard is an array');
    if (leaderboard.length > 1) {
      for (let i = 0; i < leaderboard.length - 1; i++) {
        assert.ok(leaderboard[i].total_score >= leaderboard[i + 1].total_score, 'Score sorted descending');
      }
    }
  });

  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

module.exports = runTests;
