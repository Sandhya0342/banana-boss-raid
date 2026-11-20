/**
 * ============================================================================
 * Banana Boss Raid - Authentication Controller
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise
 * Theme: D. Virtual Identity
 * 
 * ARCHITECTURE EXPLANATION (For Assessment Review):
 * Handles user lifecycle: registration, credential validation, secure hashing,
 * session creation, session destruction (logout), and profile retrieval.
 * Emits server events on registration and login.
 * ============================================================================
 */

const UserModel = require('../models/userModel');
const PlayerModel = require('../models/playerModel');
const BananaApiService = require('../services/bananaApiService');
const { gameEvents, GAME_EVENTS } = require('../events/gameEvents');

// Basic email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Username: 3 to 20 letters, digits, or underscores
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

const AuthController = {
  /**
   * Handle user registration
   */
  async register(req, res, next) {
    try {
      const { username, email, password, confirmPassword } = req.body;

      // 1. Input Validation
      if (!username || !email || !password || !confirmPassword) {
        return res.status(400).json({
          success: false,
          error: 'All fields (username, email, password, confirm password) are required.'
        });
      }

      if (!USERNAME_REGEX.test(username.trim())) {
        return res.status(400).json({
          success: false,
          error: 'Username must be 3-20 characters and contain only letters, numbers, or underscores.'
        });
      }

      if (!EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid email address.'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 6 characters long.'
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          error: 'Passwords do not match.'
        });
      }

      // 2. Check for duplicate username or email
      const existingUser = UserModel.findByUsername(username.trim());
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'Username is already taken. Please choose another one.'
        });
      }

      const existingEmail = UserModel.findByEmail(email.trim());
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          error: 'Email is already registered. Please log in or use another email.'
        });
      }

      // 3. Create user in database
      const newUser = await UserModel.createUser(username.trim(), email.trim(), password);

      // 4. Establish persistent session
      req.session.userId = newUser.id;
      req.session.username = newUser.username;

      // 5. Emit Event (Theme B: Event-Driven Programming)
      gameEvents.emit(GAME_EVENTS.USER_REGISTERED, {
        userId: newUser.id,
        username: newUser.username,
        email: newUser.email
      });

      return res.status(201).json({
        success: true,
        message: 'Account registered successfully!',
        user: newUser
      });
    } catch (error) {
      console.error('[AuthController.register] Error:', error);
      next(error);
    }
  },

  /**
   * Handle user login
   */
  async login(req, res, next) {
    try {
      const { usernameOrEmail, password } = req.body;

      if (!usernameOrEmail || !password) {
        return res.status(400).json({
          success: false,
          error: 'Please provide your username/email and password.'
        });
      }

      // Look up user by username or email
      let user = UserModel.findByUsername(usernameOrEmail.trim());
      if (!user) {
        user = UserModel.findByEmail(usernameOrEmail.trim());
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials. User not found.'
        });
      }

      // Verify bcrypt password hash
      const isMatch = await UserModel.verifyPassword(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials. Password does not match.'
        });
      }

      // Establish session
      req.session.userId = user.id;
      req.session.username = user.username;

      // Emit Event
      gameEvents.emit(GAME_EVENTS.USER_LOGIN, {
        userId: user.id,
        username: user.username
      });

      return res.json({
        success: true,
        message: 'Logged in successfully!',
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    } catch (error) {
      console.error('[AuthController.login] Error:', error);
      next(error);
    }
  },

  /**
   * Handle user logout
   */
  logout(req, res) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: 'Failed to logout cleanly from session.'
        });
      }
      res.clearCookie('connect.sid');
      return res.json({
        success: true,
        message: 'Logged out successfully.'
      });
    });
  },

  /**
   * Get current authenticated user profile & live stats
   */
  getCurrentUser(req, res) {
    if (!req.session || !req.session.userId) {
      return res.json({
        success: true,
        loggedIn: false,
        user: null
      });
    }

    const stats = PlayerModel.getStats(req.session.userId);
    if (!stats) {
      return res.json({
        success: true,
        loggedIn: false,
        user: null
      });
    }

    const attackCharges = BananaApiService.getAvailableAttackCharges(req.session.userId);

    return res.json({
      success: true,
      loggedIn: true,
      user: {
        id: stats.user_id,
        username: stats.username,
        email: stats.email,
        memberSince: stats.member_since
      },
      stats: {
        totalScore: stats.total_score,
        puzzlesSolved: stats.puzzles_solved,
        bossDamage: stats.boss_damage,
        attackCharges: attackCharges
      }
    });
  }
};

module.exports = AuthController;
