require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Initialize database
require('./database');

// Import routes
const authRoutes = require('./routes/auth');
const vendorRoutes = require('./routes/vendors');
const rfqRoutes = require('./routes/rfqs');
const quotationRoutes = require('./routes/quotations');
const approvalRoutes = require('./routes/approvals');
const poRoutes = require('./routes/purchase-orders');
const invoiceRoutes = require('./routes/invoices');
const activityRoutes = require('./routes/activity');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/rfqs', rfqRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/purchase-orders', poRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/activity', activityRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'VendorBridge Backend is running', timestamp: new Date().toISOString() });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════╗`);
  console.log(`║  VendorBridge Backend Server       ║`);
  console.log(`║  Running on http://localhost:${PORT}  ║`);
  console.log(`║  Environment: ${process.env.NODE_ENV || 'development'} ║`);
  console.log(`╚════════════════════════════════════╝\n`);
});
