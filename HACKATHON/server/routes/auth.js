const express = require('express');
const User = require('../models/User');
const validation = require('../middleware/validation');
const { generateToken } = require('../middleware/auth');
const ActivityLog = require('../models/ActivityLog');

const router = express.Router();

// Register
router.post('/register', (req, res) => {
  try {
    const { firstName, lastName, email, phone, country, additionalInfo, role, password, photo } = req.body;

    // Validate input
    const errors = validation.validateUserRegistration({ firstName, lastName, email, phone, country, role, password });
    if (errors) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    // Check if user already exists
    const existing = User.findByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create user
    const user = User.create({ firstName, lastName, email, phone, country, additionalInfo, role, password, photo });
    if (!user) {
      return res.status(400).json({ error: 'Failed to create user' });
    }

    const token = generateToken(user.id, user.email);
    ActivityLog.log(user.id, 'REGISTER', 'User', user.id, null, user);

    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = User.authenticate(email, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user.id, user.email);
    ActivityLog.log(user.id, 'LOGIN', 'User', user.id);

    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify Token
router.get('/verify', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing token' });
    }

    const token = authHeader.substring(7);
    const { generateToken: _, ...jwt } = require('jsonwebtoken');
    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
    
    const user = User.findById(decoded.uid);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({ user, token });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Forgot Password - Request Reset Token
router.post('/forgot-password', (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate a simple reset token (in production, send via email)
    const resetToken = Math.random().toString(36).slice(2, 10).toUpperCase();
    ActivityLog.log(user.id, 'FORGOT_PASSWORD_REQUEST', 'User', user.id);

    res.json({ message: `Reset token: ${resetToken} (valid for 10 minutes)`, token: resetToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Profile
router.put('/profile', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing token' });
    }

    const token = authHeader.substring(7);
    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
    
    const user = User.update(decoded.uid, req.body);
    ActivityLog.log(decoded.uid, 'UPDATE_PROFILE', 'User', decoded.uid, null, user);

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
