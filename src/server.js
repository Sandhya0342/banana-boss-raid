/**
 * ============================================================================
 * Banana Boss Raid - Main Application Server
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise (University of Bedfordshire)
 * 
 * ARCHITECTURE OVERVIEW:
 * Multi-tier client-server enterprise architecture:
 * 1. Client Tier: Browser running vanilla HTML5, CSS3, and ES6 JavaScript.
 * 2. Application Tier: Node.js + Express.js modular REST API server.
 * 3. Persistence Tier: Persistent SQLite database (schema, session storage).
 * 4. External Integration: Banana API (interoperability service).
 * ============================================================================
 */

require('dotenv').config();

const express = require('express');
const path = require('node:path');
const session = require('express-session');

const { db, SqliteSessionStore } = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const puzzleRoutes = require('./routes/puzzleRoutes');
const bossRoutes = require('./routes/bossRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ----------------------------------------------------------------------------
// Middleware Configuration
// ----------------------------------------------------------------------------

// Parse JSON request bodies
app.use(express.json());
// Parse URL-encoded form submissions
app.use(express.urlencoded({ extended: true }));

// Persistent SQLite Session Configuration (Theme D: Virtual Identity)
app.use(
  session({
    store: new SqliteSessionStore(db),
    secret: process.env.SESSION_SECRET || 'banana_boss_secret_development_key_bedfordshire',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // Mitigate XSS cookie theft
      secure: process.env.NODE_ENV === 'production', // true if served over HTTPS
      sameSite: 'lax', // CSRF protection
      maxAge: 24 * 60 * 60 * 1000 // 24 hours persistence
    }
  })
);

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../public')));

// ----------------------------------------------------------------------------
// API Routes Mounting
// ----------------------------------------------------------------------------

app.use('/api/auth', authRoutes);
app.use('/api/puzzle', puzzleRoutes);
app.use('/api/boss', bossRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Health check endpoint for monitoring and automated verification
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    application: 'Banana Boss Raid',
    university: 'University of Bedfordshire',
    course: 'CIS046-3 Software For Enterprise',
    timestamp: new Date().toISOString()
  });
});

// Fallback for client-side routing (Express 5 compatible)
app.use((req, res, next) => {
  // If request is for an unhandled API endpoint, return 404 JSON
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: `API route not found: ${req.method} ${req.path}`
    });
  }
  // Otherwise serve SPA index.html
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ----------------------------------------------------------------------------
// Centralized Error Handling Middleware
// ----------------------------------------------------------------------------

app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error occurred.'
  });
});

// ----------------------------------------------------------------------------
// Server Startup (Only when executed directly)
// ----------------------------------------------------------------------------

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`========================================================`);
    console.log(`🍌 BANANA BOSS RAID SERVER IS RUNNING`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`📚 Course: CIS046-3 Software For Enterprise`);
    console.log(`💾 Database: SQLite (WAL Mode & Persistent Session Store)`);
    console.log(`========================================================`);
  });

  // Graceful shutdown handling
  const shutdown = () => {
    console.log('\n[Server] Gracefully shutting down...');
    server.close(() => {
      console.log('[Server] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = app;
