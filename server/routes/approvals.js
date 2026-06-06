const express = require('express');
const Approval = require('../models/Approval');
const RFQ = require('../models/RFQ');
const { authMiddleware } = require('../middleware/auth');
const ActivityLog = require('../models/ActivityLog');

const router = express.Router();

// Create approval workflow for a quotation
router.post('/', authMiddleware, (req, res) => {
  try {
    const { rfqId, quotationId } = req.body;

    if (!rfqId || !quotationId) {
      return res.status(400).json({ error: 'RFQ ID and Quotation ID are required' });
    }

    const approval = Approval.create(rfqId, quotationId);
    ActivityLog.log(req.user.uid, 'CREATE_APPROVAL', 'Approval', approval.id, null, approval);

    res.status(201).json(approval);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get approval by RFQ
router.get('/rfq/:rfqId', authMiddleware, (req, res) => {
  try {
    const approval = Approval.findByRFQ(req.params.rfqId);
    
    if (!approval) {
      return res.status(404).json({ error: 'No approval found for this RFQ' });
    }

    res.json(approval);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single approval
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const approval = Approval.findById(req.params.id);
    
    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    res.json(approval);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update approval step (approve)
router.patch('/:id/approve', authMiddleware, (req, res) => {
  try {
    const { remarks } = req.body;
    
    const approval = Approval.findById(req.params.id);
    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    if (!Approval.canApprove(req.params.id)) {
      return res.status(400).json({ error: 'Cannot approve this workflow' });
    }

    // Update chain status and step
    Approval.updateChainStatus(req.params.id, req.user.uid, 'Approved', remarks);
    const newStep = approval.currentStep + 1;
    
    let newStatus = 'Pending';
    if (newStep > approval.maxSteps) {
      newStatus = 'Approved';
    }

    const updated = Approval.updateStep(req.params.id, newStep);
    if (newStatus === 'Approved') {
      Approval.updateStatus(req.params.id, newStatus);
    }

    ActivityLog.log(req.user.uid, 'APPROVE_APPROVAL', 'Approval', req.params.id, null, { step: newStep });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reject approval
router.patch('/:id/reject', authMiddleware, (req, res) => {
  try {
    const { remarks } = req.body;

    const approval = Approval.findById(req.params.id);
    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    Approval.updateChainStatus(req.params.id, req.user.uid, 'Rejected', remarks);
    const updated = Approval.updateStatus(req.params.id, 'Rejected');

    ActivityLog.log(req.user.uid, 'REJECT_APPROVAL', 'Approval', req.params.id, null, { remarks });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
