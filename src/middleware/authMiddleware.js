/**
 * ============================================================================
 * Banana Boss Raid - Authentication Middleware
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise
 * Theme: D. Virtual Identity & Protected Routes
 * 
 * ARCHITECTURE EXPLANATION (For Assessment Review):
 * Express middleware that inspects session state on incoming requests.
 * Protects sensitive endpoints (puzzle generation, answer submission, boss attacks)
 * from unauthenticated access.
 * ============================================================================
 */

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    req.user = {
      id: req.session.userId,
      username: req.session.username
    };
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized. Please log in to access this feature.'
  });
}

module.exports = {
  requireAuth
};
