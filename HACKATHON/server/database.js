const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './procurement.db';

// Create database instance
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Initialize schema
function initializeDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      country TEXT NOT NULL,
      additionalInfo TEXT,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      photo BLOB,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Vendors table
  db.exec(`
    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      gst TEXT UNIQUE NOT NULL,
      contact TEXT NOT NULL,
      status TEXT DEFAULT 'Active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // RFQ (Request for Quotation) table
  db.exec(`
    CREATE TABLE IF NOT EXISTS rfqs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'Draft',
      createdBy TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (createdBy) REFERENCES users(id)
    );
  `);

  // RFQ Line Items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS rfq_line_items (
      id TEXT PRIMARY KEY,
      rfqId TEXT NOT NULL,
      item TEXT NOT NULL,
      qty INTEGER NOT NULL,
      unit TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rfqId) REFERENCES rfqs(id)
    );
  `);

  // RFQ Vendors (many-to-many relationship)
  db.exec(`
    CREATE TABLE IF NOT EXISTS rfq_vendors (
      id TEXT PRIMARY KEY,
      rfqId TEXT NOT NULL,
      vendorId TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rfqId) REFERENCES rfqs(id),
      FOREIGN KEY (vendorId) REFERENCES vendors(id),
      UNIQUE(rfqId, vendorId)
    );
  `);

  // Quotations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS quotations (
      id TEXT PRIMARY KEY,
      rfqId TEXT NOT NULL,
      vendorId TEXT NOT NULL,
      totalPrice DECIMAL(12, 2) NOT NULL,
      gstPercent DECIMAL(5, 2) DEFAULT 18,
      gstAmount DECIMAL(12, 2),
      finalPrice DECIMAL(12, 2),
      deliveryDays INTEGER,
      paymentTerms TEXT,
      vendorRating DECIMAL(3, 1),
      status TEXT DEFAULT 'Submitted',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rfqId) REFERENCES rfqs(id),
      FOREIGN KEY (vendorId) REFERENCES vendors(id)
    );
  `);

  // Approvals table
  db.exec(`
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      rfqId TEXT NOT NULL,
      quotationId TEXT NOT NULL,
      currentStep INTEGER DEFAULT 1,
      maxSteps INTEGER DEFAULT 4,
      status TEXT DEFAULT 'Pending',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rfqId) REFERENCES rfqs(id),
      FOREIGN KEY (quotationId) REFERENCES quotations(id)
    );
  `);

  // Approval Chain (tracks each approver)
  db.exec(`
    CREATE TABLE IF NOT EXISTS approval_chain (
      id TEXT PRIMARY KEY,
      approvalId TEXT NOT NULL,
      approverId TEXT NOT NULL,
      approverRole TEXT NOT NULL,
      status TEXT DEFAULT 'Awaiting',
      remarks TEXT,
      approvedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (approvalId) REFERENCES approvals(id),
      FOREIGN KEY (approverId) REFERENCES users(id)
    );
  `);

  // Purchase Orders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      poNumber TEXT UNIQUE NOT NULL,
      rfqId TEXT NOT NULL,
      quotationId TEXT NOT NULL,
      vendorId TEXT NOT NULL,
      totalAmount DECIMAL(12, 2) NOT NULL,
      status TEXT DEFAULT 'Generated',
      createdBy TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rfqId) REFERENCES rfqs(id),
      FOREIGN KEY (quotationId) REFERENCES quotations(id),
      FOREIGN KEY (vendorId) REFERENCES vendors(id),
      FOREIGN KEY (createdBy) REFERENCES users(id)
    );
  `);

  // PO Line Items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS po_line_items (
      id TEXT PRIMARY KEY,
      poId TEXT NOT NULL,
      item TEXT NOT NULL,
      qty INTEGER NOT NULL,
      unit TEXT NOT NULL,
      unitPrice DECIMAL(12, 2) NOT NULL,
      totalPrice DECIMAL(12, 2) NOT NULL,
      FOREIGN KEY (poId) REFERENCES purchase_orders(id)
    );
  `);

  // Invoices table
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoiceNumber TEXT UNIQUE NOT NULL,
      poId TEXT NOT NULL,
      vendorId TEXT NOT NULL,
      totalAmount DECIMAL(12, 2) NOT NULL,
      gstAmount DECIMAL(12, 2),
      finalAmount DECIMAL(12, 2) NOT NULL,
      dueDate DATE NOT NULL,
      status TEXT DEFAULT 'Pending',
      paymentStatus TEXT DEFAULT 'Unpaid',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      paidAt DATETIME,
      FOREIGN KEY (poId) REFERENCES purchase_orders(id),
      FOREIGN KEY (vendorId) REFERENCES vendors(id)
    );
  `);

  // Activity/Audit Log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      action TEXT NOT NULL,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      oldValue TEXT,
      newValue TEXT,
      ipAddress TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    );
  `);

  console.log('✓ Database initialized successfully');
}

// Seed demo data
function seedDatabase() {
  const crypto = require('crypto');
  const bcryptjs = require('bcryptjs');

  // Check if data already seeded
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count > 0) {
    console.log('✓ Database already seeded');
    return;
  }

  const hashedPassword = bcryptjs.hashSync('Admin@123', 10);

  // Seed admin user
  db.prepare(`
    INSERT INTO users (id, firstName, lastName, email, phone, country, additionalInfo, role, password_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    'Arjun',
    'Mehta',
    'admin@demo.com',
    '9876543210',
    'India',
    'Procurement Head',
    'Procurement Officer',
    hashedPassword
  );

  // Seed vendors
  const vendors = [
    { name: 'Infra Supplies Pvt Ltd', category: 'Construction', gst: '22A@BCSM*0', contact: '412 #vendor' },
    { name: 'Tech Core LTD', category: 'IT', gst: '22A@BCSM2', contact: '412 #vendor' },
    { name: 'Fleeting Transport', category: 'Logistics', gst: '22A@BCSM3bc', contact: '—' },
  ];

  vendors.forEach(v => {
    db.prepare(`
      INSERT INTO vendors (id, name, category, gst, contact, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), v.name, v.category, v.gst, v.contact, 'Active');
  });

  console.log('✓ Demo data seeded successfully');
}

// Initialize on load
initializeDatabase();
seedDatabase();

module.exports = db;
