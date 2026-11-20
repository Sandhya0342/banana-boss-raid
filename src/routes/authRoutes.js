/**
 * ============================================================================
 * Banana Boss Raid - Authentication Routes
 * ============================================================================
 * Course: CIS046-3 Software For Enterprise
 */

const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/me', AuthController.getCurrentUser);

module.exports = router;
