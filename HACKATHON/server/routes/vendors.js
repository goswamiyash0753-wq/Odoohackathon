const express = require('express');
const Vendor = require('../models/Vendor');
const { authMiddleware } = require('../middleware/auth');
const ActivityLog = require('../models/ActivityLog');

const router = express.Router();

// Get all vendors with filters
router.get('/', authMiddleware, (req, res) => {
  try {
    const { status, search } = req.query;
    const vendors = Vendor.findAll({ status, search });
    const stats = Vendor.getStats();
    
    res.json({ vendors, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single vendor
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const vendor = Vendor.findById(req.params.id);
    
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    res.json(vendor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create vendor
router.post('/', authMiddleware, (req, res) => {
  try {
    const { name, category, gst, contact } = req.body;

    if (!name || !category || !gst || !contact) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const vendor = Vendor.create(req.body);
    
    if (!vendor) {
      return res.status(400).json({ error: 'Vendor with this GST already exists' });
    }

    ActivityLog.log(req.user.uid, 'CREATE_VENDOR', 'Vendor', vendor.id, null, vendor);

    res.status(201).json(vendor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update vendor
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const vendor = Vendor.findById(req.params.id);
    
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const updated = Vendor.update(req.params.id, req.body);
    ActivityLog.log(req.user.uid, 'UPDATE_VENDOR', 'Vendor', req.params.id, vendor, updated);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete vendor
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const vendor = Vendor.findById(req.params.id);
    
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    Vendor.delete(req.params.id);
    ActivityLog.log(req.user.uid, 'DELETE_VENDOR', 'Vendor', req.params.id, vendor, null);

    res.json({ message: 'Vendor deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
