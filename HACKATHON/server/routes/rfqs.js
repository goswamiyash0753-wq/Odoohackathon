const express = require('express');
const RFQ = require('../models/RFQ');
const Quotation = require('../models/Quotation');
const { authMiddleware } = require('../middleware/auth');
const ActivityLog = require('../models/ActivityLog');

const router = express.Router();

// Get all RFQs for user
router.get('/', authMiddleware, (req, res) => {
  try {
    const { status } = req.query;
    const rfqs = RFQ.findAll(req.user.uid, { status });
    const stats = RFQ.getStats(req.user.uid);
    
    res.json({ rfqs, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single RFQ with details
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const rfq = RFQ.findById(req.params.id);
    
    if (!rfq) {
      return res.status(404).json({ error: 'RFQ not found' });
    }

    // Get quotations for this RFQ
    const quotations = Quotation.findByRFQ(req.params.id);
    
    res.json({ rfq, quotations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create RFQ
router.post('/', authMiddleware, (req, res) => {
  try {
    const { title, category, description, vendors, lineItems } = req.body;

    if (!title || !category) {
      return res.status(400).json({ error: 'Title and category are required' });
    }

    const rfq = RFQ.create(req.body, req.user.uid);
    ActivityLog.log(req.user.uid, 'CREATE_RFQ', 'RFQ', rfq.id, null, rfq);

    res.status(201).json(rfq);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update RFQ status
router.patch('/:id/status', authMiddleware, (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const rfq = RFQ.updateStatus(req.params.id, status);
    ActivityLog.log(req.user.uid, 'UPDATE_RFQ_STATUS', 'RFQ', req.params.id, null, { status });

    res.json(rfq);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
