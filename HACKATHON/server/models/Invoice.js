const db = require('../database');
const { v4: uuidv4 } = require('uuid');

class Invoice {
  static generateInvoiceNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `INV-${year}${month}-${random}`;
  }

  static create(poId, invoiceData) {
    const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(poId);
    if (!po) return null;

    const { gstPercent = 18, dueDate } = invoiceData;
    const id = uuidv4();
    const invoiceNumber = this.generateInvoiceNumber();
    
    const gstAmount = po.totalAmount * (gstPercent / 100);
    const finalAmount = po.totalAmount + gstAmount;

    const stmt = db.prepare(`
      INSERT INTO invoices (id, invoiceNumber, poId, vendorId, totalAmount, gstAmount, finalAmount, dueDate, status, paymentStatus)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      invoiceNumber,
      poId,
      po.vendorId,
      po.totalAmount,
      gstAmount,
      finalAmount,
      dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      'Pending',
      'Unpaid'
    );

    return this.findById(id);
  }

  static findById(id) {
    const stmt = db.prepare(`
      SELECT inv.*, v.name as vendorName, v.gst, v.contact, po.poNumber
      FROM invoices inv
      JOIN vendors v ON inv.vendorId = v.id
      JOIN purchase_orders po ON inv.poId = po.id
      WHERE inv.id = ?
    `);
    return stmt.get(id);
  }

  static findByInvoiceNumber(invoiceNumber) {
    return db.prepare('SELECT * FROM invoices WHERE invoiceNumber = ?').get(invoiceNumber);
  }

  static findAll(filters = {}) {
    let query = 'SELECT * FROM invoices WHERE 1=1';
    const params = [];

    if (filters.vendorId) {
      query += ' AND vendorId = ?';
      params.push(filters.vendorId);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.paymentStatus) {
      query += ' AND paymentStatus = ?';
      params.push(filters.paymentStatus);
    }

    query += ' ORDER BY createdAt DESC';
    const stmt = db.prepare(query);
    return stmt.all(...params);
  }

  static updatePaymentStatus(id, paymentStatus, paidAmount) {
    const stmt = db.prepare(`
      UPDATE invoices 
      SET paymentStatus = ?, paidAt = CURRENT_TIMESTAMP, status = 'Paid'
      WHERE id = ?
    `);
    stmt.run(paymentStatus, id);
    return this.findById(id);
  }

  static getStats() {
    const total = db.prepare('SELECT COUNT(*) as count FROM invoices').get();
    const pending = db.prepare('SELECT COUNT(*) as count FROM invoices WHERE paymentStatus = ?').get('Unpaid');
    const paid = db.prepare('SELECT COUNT(*) as count FROM invoices WHERE paymentStatus = ?').get('Paid');
    const overdue = db.prepare(`
      SELECT COUNT(*) as count FROM invoices 
      WHERE paymentStatus = ? AND dueDate < DATE('now')
    `).get('Unpaid');

    return {
      total: total.count,
      pending: pending.count,
      paid: paid.count,
      overdue: overdue.count,
    };
  }
}

module.exports = Invoice;
