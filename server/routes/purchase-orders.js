const express = require('express');
const PurchaseOrder = require('../models/PurchaseOrder');
const Quotation = require('../models/Quotation');
const { authMiddleware } = require('../middleware/auth');
const ActivityLog = require('../models/ActivityLog');

const router = express.Router();

// Get all purchase orders
router.get('/', authMiddleware, (req, res) => {
  try {
    const { vendorId, status } = req.query;
    const pos = PurchaseOrder.findAll({ vendorId, status });
    const stats = PurchaseOrder.getStats();
    
    res.json({ pos, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single purchase order
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const po = PurchaseOrder.findById(req.params.id);
    
    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    res.json(po);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create purchase order from quotation
router.post('/', authMiddleware, (req, res) => {
  try {
    const { quotationId } = req.body;

    if (!quotationId) {
      return res.status(400).json({ error: 'Quotation ID is required' });
    }

    const po = PurchaseOrder.create(quotationId, req.user.uid);
    
    if (!po) {
      return res.status(400).json({ error: 'Could not create purchase order' });
    }

    ActivityLog.log(req.user.uid, 'CREATE_PO', 'PurchaseOrder', po.id, null, po);

    res.status(201).json(po);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update purchase order status
router.patch('/:id/status', authMiddleware, (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const po = PurchaseOrder.updateStatus(req.params.id, status);
    ActivityLog.log(req.user.uid, 'UPDATE_PO_STATUS', 'PurchaseOrder', req.params.id, null, { status });

    res.json(po);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
