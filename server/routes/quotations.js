const express = require('express');
const Quotation = require('../models/Quotation');
const RFQ = require('../models/RFQ');
const { authMiddleware } = require('../middleware/auth');
const ActivityLog = require('../models/ActivityLog');

const router = express.Router();

// Get quotations for an RFQ
router.get('/rfq/:rfqId', authMiddleware, (req, res) => {
  try {
    const rfq = RFQ.findById(req.params.rfqId);
    
    if (!rfq) {
      return res.status(404).json({ error: 'RFQ not found' });
    }

    const quotations = Quotation.findByRFQ(req.params.rfqId);
    const lowestPrice = Quotation.getLowestPrice(req.params.rfqId);
    
    res.json({ quotations, lowestPrice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single quotation
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const quotation = Quotation.findById(req.params.id);
    
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    res.json(quotation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create quotation
router.post('/', authMiddleware, (req, res) => {
  try {
    const { rfqId, vendorId, totalPrice, gstPercent, deliveryDays, paymentTerms, vendorRating } = req.body;

    if (!rfqId || !vendorId || !totalPrice) {
      return res.status(400).json({ error: 'RFQ ID, Vendor ID, and price are required' });
    }

    const rfq = RFQ.findById(rfqId);
    if (!rfq) {
      return res.status(404).json({ error: 'RFQ not found' });
    }

    if (!rfq.vendors.some(vendor => vendor.vendorId === vendorId)) {
      return res.status(400).json({ error: 'Vendor is not attached to this RFQ' });
    }

    const quotation = Quotation.create(req.body);
    ActivityLog.log(req.user.uid, 'CREATE_QUOTATION', 'Quotation', quotation.id, null, quotation);

    res.status(201).json(quotation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update quotation status
router.patch('/:id/status', authMiddleware, (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const allowedStatuses = ['Submitted', 'Shortlisted', 'Approved', 'Rejected'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid quotation status' });
    }

    const quotation = Quotation.updateStatus(req.params.id, status);
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    ActivityLog.log(req.user.uid, 'UPDATE_QUOTATION_STATUS', 'Quotation', req.params.id, null, { status });

    res.json(quotation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
