/**
 * ============================================================================
 * Banana Boss Raid - Server-Side Game Event Hub (EventEmitter)
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise (University of Bedfordshire)
 * Theme: B. Event-Driven Programming
 * 
 * ARCHITECTURE EXPLANATION (For Assessment Review):
 * Event-Driven Architecture (EDA) decouples components: producers emit events
 * without needing to know which consumers are listening.
 * 
 * In this file, Node.js EventEmitter is used to publish critical game lifecycle
 * events. Listeners log activities, update telemetry, and maintain an in-memory
 * recent event feed that clients can query during boss raids.
 * ============================================================================
 */

const EventEmitter = require('node:events');

class GameEventEmitter extends EventEmitter {}

const gameEvents = new GameEventEmitter();

// Event Names Constants
const GAME_EVENTS = {
  USER_REGISTERED: 'user:registered',
  USER_LOGIN: 'user:login',
  PUZZLE_REQUESTED: 'puzzle:requested',
  PUZZLE_SOLVED: 'puzzle:solved',
  PUZZLE_FAILED: 'puzzle:failed',
  BOSS_ATTACKED: 'boss:attacked',
  BOSS_DEFEATED: 'boss:defeated',
  BOSS_RESET: 'boss:reset'
};

// Recent event feed buffer (last 20 events for live activity log)
const recentActivityFeed = [];
const MAX_FEED_ITEMS = 20;

function addToActivityFeed(type, message, metadata = {}) {
  const item = {
    id: Date.now() + Math.random().toString(36).substring(2, 7),
    type,
    message,
    metadata,
    timestamp: new Date().toISOString()
  };
  recentActivityFeed.unshift(item);
  if (recentActivityFeed.length > MAX_FEED_ITEMS) {
    recentActivityFeed.pop();
  }
}

// ----------------------------------------------------------------------------
// Event Listeners (Demonstrates Server-Side Event Handling)
// ----------------------------------------------------------------------------

gameEvents.on(GAME_EVENTS.USER_REGISTERED, (payload) => {
  console.log(`[Event: USER_REGISTERED] Welcome ${payload.username} (ID: ${payload.userId})`);
  addToActivityFeed(GAME_EVENTS.USER_REGISTERED, `New explorer ${payload.username} joined the raid!`, payload);
});

gameEvents.on(GAME_EVENTS.USER_LOGIN, (payload) => {
  console.log(`[Event: USER_LOGIN] ${payload.username} logged in.`);
});

gameEvents.on(GAME_EVENTS.PUZZLE_REQUESTED, (payload) => {
  console.log(`[Event: PUZZLE_REQUESTED] User ${payload.userId} requested puzzle ${payload.puzzleId}`);
});

gameEvents.on(GAME_EVENTS.PUZZLE_SOLVED, (payload) => {
  console.log(`[Event: PUZZLE_SOLVED] User ${payload.username} (ID: ${payload.userId}) solved puzzle +${payload.scoreEarned} pts`);
  addToActivityFeed(GAME_EVENTS.PUZZLE_SOLVED, `${payload.username} solved a Banana Puzzle! (+${payload.scoreEarned} pts)`, payload);
});

gameEvents.on(GAME_EVENTS.PUZZLE_FAILED, (payload) => {
  console.log(`[Event: PUZZLE_FAILED] User ${payload.userId} failed puzzle ${payload.puzzleId}`);
});

gameEvents.on(GAME_EVENTS.BOSS_ATTACKED, (payload) => {
  console.log(`[Event: BOSS_ATTACKED] ${payload.username} dealt ${payload.damage} damage to Boss #${payload.raidId}. Remaining HP: ${payload.remainingHealth}`);
  addToActivityFeed(GAME_EVENTS.BOSS_ATTACKED, `${payload.username} struck the Boss for ${payload.damage} damage!`, payload);
});

gameEvents.on(GAME_EVENTS.BOSS_DEFEATED, (payload) => {
  console.log(`[Event: BOSS_DEFEATED] Boss #${payload.raidId} was defeated by ${payload.username}!`);
  addToActivityFeed(GAME_EVENTS.BOSS_DEFEATED, `VICTORY! ${payload.username} delivered the final blow to defeat the Boss!`, payload);
});

gameEvents.on(GAME_EVENTS.BOSS_RESET, (payload) => {
  console.log(`[Event: BOSS_RESET] A new boss appeared: ${payload.bossName} with ${payload.maxHealth} HP.`);
  addToActivityFeed(GAME_EVENTS.BOSS_RESET, `A new threat emerges: ${payload.bossName}!`, payload);
});

module.exports = {
  gameEvents,
  GAME_EVENTS,
  getRecentActivityFeed: () => [...recentActivityFeed]
};
