/**
 * ============================================================================
 * Banana Boss Raid - End-to-End HTTP Integration Test
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise (University of Bedfordshire)
 * 
 * Verifies that the Express HTTP server, session cookie persistence,
 * protected REST endpoints, and database interactions function correctly end-to-end.
 * ============================================================================
 */

const assert = require('node:assert');
const http = require('node:http');
const app = require('../src/server');
const { db } = require('../src/config/database');

async function runIntegrationTests() {
  console.log('====================================================');
  console.log('🌐 RUNNING HTTP REST API INTEGRATION TESTS');
  console.log('====================================================\n');

  // Start temporary server on dynamic port bound to loopback IPv4
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let sessionCookie = '';

  function request(method, path, body = null, cookie = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const headers = { 'Content-Type': 'application/json' };
      if (cookie) headers['Cookie'] = cookie;

      const req = http.request(url, { method, headers }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch (e) {}
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: json || data
          });
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message || err);
      if (err.stack) console.error(err.stack);
      failed++;
    }
  }

  try {
    // TEST 1: Health check endpoint
    await test('GET /api/health returns 200 OK with system status', async () => {
      const res = await request('GET', '/api/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'healthy');
      assert.strictEqual(res.body.application, 'Banana Boss Raid');
    });

    // TEST 2: Static HTML delivery
    await test('GET / serves index.html frontend', async () => {
      const res = await request('GET', '/');
      assert.strictEqual(res.status, 200);
      assert.ok(typeof res.body === 'string' && res.body.includes('Banana Boss Raid'), 'Contains app title');
    });

    // TEST 3: User Registration via REST API (max 20 chars for username)
    const testUsername = `usr_${Date.now().toString().slice(-10)}`;
    await test('POST /api/auth/register creates user and returns session cookie', async () => {
      const res = await request('POST', '/api/auth/register', {
        username: testUsername,
        email: `${testUsername}@beds.ac.uk`,
        password: 'Password123!',
        confirmPassword: 'Password123!'
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.user.username, testUsername);

      // Extract set-cookie header
      const setCookie = res.headers['set-cookie'];
      assert.ok(setCookie && setCookie.length > 0, 'Set-Cookie header received');
      sessionCookie = setCookie[0].split(';')[0];
      assert.ok(sessionCookie.startsWith('connect.sid='), 'Session cookie is connect.sid');
    });

    // TEST 4: Persistent Session Verification
    await test('GET /api/auth/me returns authenticated user using session cookie', async () => {
      const res = await request('GET', '/api/auth/me', null, sessionCookie);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.loggedIn, true);
      assert.strictEqual(res.body.user.username, testUsername);
      assert.ok(res.body.stats !== undefined, 'Stats object included');
    });

    // TEST 5: Protected Route Enforcement
    await test('Protected routes reject unauthenticated requests with 401', async () => {
      const res = await request('GET', '/api/puzzle/new'); // No session cookie
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.error.includes('Unauthorized'));
    });

    // TEST 6: Puzzle Generation via REST
    let puzzleId;
    await test('GET /api/puzzle/new returns puzzle question and conceals solution', async () => {
      const res = await request('GET', '/api/puzzle/new', null, sessionCookie);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.puzzleId, 'Received puzzleId');
      assert.ok(res.body.question, 'Received question image URL');
      assert.strictEqual(res.body.solution, undefined, 'Solution is NOT sent to client');
      puzzleId = res.body.puzzleId;
    });

    // TEST 7: Puzzle Answer Submission via REST
    await test('POST /api/puzzle/submit validates answer and awards points', async () => {
      // Lookup actual solution from database (simulating correct player input)
      const stored = db.prepare('SELECT solution FROM puzzle_sessions WHERE id = ?').get(puzzleId);
      assert.ok(stored, 'Stored puzzle session found in database');

      const res = await request('POST', '/api/puzzle/submit', {
        puzzleId,
        answer: stored.solution
      }, sessionCookie);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.correct, true);
      assert.strictEqual(res.body.pointsAwarded, 10);
      assert.strictEqual(res.body.stats.attackCharges, 1);
    });

    // TEST 8: Boss Status Retrieval via REST
    await test('GET /api/boss/status returns active raid and participants', async () => {
      const res = await request('GET', '/api/boss/status', null, sessionCookie);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.boss, 'Boss object present');
      assert.ok(res.body.boss.currentHealth > 0, 'Boss has positive health');
      assert.strictEqual(res.body.userCharges, 1);
    });

    // TEST 9: Boss Attack Execution via REST
    await test('POST /api/boss/attack consumes charge, decrements HP, and awards score', async () => {
      const res = await request('POST', '/api/boss/attack', {}, sessionCookie);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.damageDealt >= 25, 'Damage was dealt');
      assert.strictEqual(res.body.userCharges, 0, 'Attack charge was consumed');
    });

    // TEST 10: Attack Prevention without Charges
    await test('POST /api/boss/attack without charges returns 400 Bad Request', async () => {
      const res = await request('POST', '/api/boss/attack', {}, sessionCookie);
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.error.includes('No attack charges'));
    });

    // TEST 11: Leaderboard Standings via REST
    await test('GET /api/leaderboard returns ranked players list', async () => {
      const res = await request('GET', '/api/leaderboard');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.leaderboard));
      assert.ok(res.body.leaderboard.length > 0);
      const testEntry = res.body.leaderboard.find(p => p.username === testUsername);
      assert.ok(testEntry, 'Registered test user appears on leaderboard');
      assert.ok(testEntry.total_score > 0, 'Test user accumulated score');
    });

    // TEST 12: User Logout via REST
    await test('POST /api/auth/logout destroys session', async () => {
      const res = await request('POST', '/api/auth/logout', {}, sessionCookie);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      // Verify session is destroyed
      const meRes = await request('GET', '/api/auth/me', null, sessionCookie);
      assert.strictEqual(meRes.body.loggedIn, false);
    });

  } finally {
    server.close();
  }

  console.log('\n====================================================');
  console.log(`📊 INTEGRATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  runIntegrationTests().catch(err => {
    console.error('Integration test failed:', err);
    process.exit(1);
  });
}

module.exports = runIntegrationTests;
