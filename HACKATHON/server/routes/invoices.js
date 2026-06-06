const express = require('express');
const Invoice = require('../models/Invoice');
const PurchaseOrder = require('../models/PurchaseOrder');
const { authMiddleware } = require('../middleware/auth');
const ActivityLog = require('../models/ActivityLog');

const router = express.Router();

// Get all invoices
router.get('/', authMiddleware, (req, res) => {
  try {
    const { vendorId, status, paymentStatus } = req.query;
    const invoices = Invoice.findAll({ vendorId, status, paymentStatus });
    const stats = Invoice.getStats();
    
    res.json({ invoices, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single invoice
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const invoice = Invoice.findById(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create invoice from purchase order
router.post('/', authMiddleware, (req, res) => {
  try {
    const { poId, gstPercent, dueDate } = req.body;

    if (!poId) {
      return res.status(400).json({ error: 'Purchase order ID is required' });
    }

    const invoice = Invoice.create(poId, { gstPercent, dueDate });
    
    if (!invoice) {
      return res.status(400).json({ error: 'Could not create invoice' });
    }

    ActivityLog.log(req.user.uid, 'CREATE_INVOICE', 'Invoice', invoice.id, null, invoice);

    res.status(201).json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update payment status
router.patch('/:id/payment', authMiddleware, (req, res) => {
  try {
    const { paymentStatus } = req.body;

    if (!paymentStatus) {
      return res.status(400).json({ error: 'Payment status is required' });
    }

    const invoice = Invoice.updatePaymentStatus(req.params.id, paymentStatus);
    ActivityLog.log(req.user.uid, 'UPDATE_INVOICE_PAYMENT', 'Invoice', req.params.id, null, { paymentStatus });

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
