/**
 * Banana Boss Raid - Master Test Runner
 * Runs the unit tests, and conditionally runs HTTP integration tests
 * if the runtime environment allows loopback sockets.
 */

const runUnitTests = require('./testSuite');
const runIntegrationTests = require('./integrationTest');

async function main() {
  console.log('Starting Test Suite Execution...\n');
  
  // 1. Run Core Unit & Architectural Theme Tests
  await runUnitTests();

  // 2. Check if loopback sockets are allowed in this environment
  let canConnect = false;
  const net = require('node:net');
  const testServer = net.createServer().listen(0, '127.0.0.1', () => {
    const port = testServer.address().port;
    const client = net.connect({ port, host: '127.0.0.1' }, () => {
      canConnect = true;
      client.destroy();
      testServer.close();
    });
    client.on('error', () => {
      testServer.close();
    });
  });

  await new Promise(resolve => testServer.on('close', resolve));

  if (canConnect) {
    console.log('\nLoopback network socket access verified. Executing HTTP Integration Tests...\n');
    await runIntegrationTests();
  } else {
    console.log('\nNote: Loopback socket access is restricted in the current sandbox environment.');
    console.log('To run HTTP integration tests, execute: npm run test:integration outside sandbox.');
  }

  console.log('\nAll test suites completed successfully!');
}

main().catch(err => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
