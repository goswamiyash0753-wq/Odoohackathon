const db = require('../database');
const { v4: uuidv4 } = require('uuid');

class PurchaseOrder {
  static generatePONumber() {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PO-${timestamp}-${random}`;
  }

  static create(quotationId, userId) {
    const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(quotationId);
    if (!quotation) return null;

    const id = uuidv4();
    const poNumber = this.generatePONumber();

    const stmt = db.prepare(`
      INSERT INTO purchase_orders (id, poNumber, rfqId, quotationId, vendorId, totalAmount, status, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      poNumber,
      quotation.rfqId,
      quotationId,
      quotation.vendorId,
      quotation.finalPrice,
      'Generated',
      userId
    );

    // Create PO line items from RFQ line items
    const lineItems = db.prepare(`
      SELECT item, qty, unit FROM rfq_line_items WHERE rfqId = ?
    `).all(quotation.rfqId);

    if (lineItems.length > 0) {
      const unitPrice = quotation.totalPrice / lineItems.length;
      const lineStmt = db.prepare(`
        INSERT INTO po_line_items (id, poId, item, qty, unit, unitPrice, totalPrice)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      lineItems.forEach(item => {
        const totalPrice = unitPrice * item.qty;
        lineStmt.run(
          uuidv4(),
          id,
          item.item,
          item.qty,
          item.unit,
          unitPrice,
          totalPrice
        );
      });
    }

    return this.findById(id);
  }

  static findById(id) {
    const po = db.prepare(`
      SELECT po.*, v.name as vendorName, v.gst, v.contact
      FROM purchase_orders po
      JOIN vendors v ON po.vendorId = v.id
      WHERE po.id = ?
    `).get(id);

    if (!po) return null;

    const lineItems = db.prepare(`
      SELECT id, item, qty, unit, unitPrice, totalPrice FROM po_line_items WHERE poId = ?
    `).all(id);

    return { ...po, lineItems };
  }

  static findByPONumber(poNumber) {
    return db.prepare('SELECT * FROM purchase_orders WHERE poNumber = ?').get(poNumber);
  }

  static findAll(filters = {}) {
    let query = 'SELECT * FROM purchase_orders WHERE 1=1';
    const params = [];

    if (filters.vendorId) {
      query += ' AND vendorId = ?';
      params.push(filters.vendorId);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY createdAt DESC';
    const stmt = db.prepare(query);
    return stmt.all(...params);
  }

  static updateStatus(id, status) {
    const stmt = db.prepare('UPDATE purchase_orders SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(status, id);
    return this.findById(id);
  }

  static getStats() {
    const total = db.prepare('SELECT COUNT(*) as count FROM purchase_orders').get();
    const generated = db.prepare('SELECT COUNT(*) as count FROM purchase_orders WHERE status = ?').get('Generated');
    const approved = db.prepare('SELECT COUNT(*) as count FROM purchase_orders WHERE status = ?').get('Approved');
    const completed = db.prepare('SELECT COUNT(*) as count FROM purchase_orders WHERE status = ?').get('Completed');

    return {
      total: total.count,
      generated: generated.count,
      approved: approved.count,
      completed: completed.count,
    };
  }
}

module.exports = PurchaseOrder;
