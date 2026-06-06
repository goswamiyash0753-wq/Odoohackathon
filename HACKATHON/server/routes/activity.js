const express = require('express');
const ActivityLog = require('../models/ActivityLog');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get recent activity
router.get('/', authMiddleware, (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const logs = ActivityLog.getRecentActivity(parseInt(limit));
    
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get activity for user
router.get('/user/:userId', authMiddleware, (req, res) => {
  try {
    const logs = ActivityLog.findAll({ userId: req.params.userId });
    
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get activity by entity
router.get('/entity/:entityType/:entityId', authMiddleware, (req, res) => {
  try {
    const logs = ActivityLog.getActivityByEntity(req.params.entityType, req.params.entityId);
    
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
