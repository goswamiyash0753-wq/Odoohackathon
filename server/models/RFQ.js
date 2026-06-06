const db = require('../database');
const { v4: uuidv4 } = require('uuid');

class RFQ {
  static create(rfqData, userId) {
    const { title, category, description, vendors, lineItems } = rfqData;
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO rfqs (id, title, category, description, status, createdBy)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, title, category, description || '', 'Draft', userId);

    // Add line items
    if (lineItems && lineItems.length > 0) {
      const lineStmt = db.prepare(`
        INSERT INTO rfq_line_items (id, rfqId, item, qty, unit)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      lineItems.forEach(item => {
        lineStmt.run(uuidv4(), id, item.item, item.qty, item.unit);
      });
    }

    // Add vendors
    if (vendors && vendors.length > 0) {
      const vendorStmt = db.prepare(`
        INSERT INTO rfq_vendors (id, rfqId, vendorId)
        VALUES (?, ?, ?)
      `);
      
      vendors.forEach(vendorId => {
        vendorStmt.run(uuidv4(), id, vendorId);
      });
    }

    return this.findById(id);
  }

  static findById(id) {
    const rfq = db.prepare('SELECT * FROM rfqs WHERE id = ?').get(id);
    if (!rfq) return null;

    const lineItems = db.prepare(`
      SELECT id, item, qty, unit FROM rfq_line_items WHERE rfqId = ?
    `).all(id);

    const vendors = db.prepare(`
      SELECT rv.id, rv.vendorId, v.name, v.category, v.gst, v.status
      FROM rfq_vendors rv
      JOIN vendors v ON rv.vendorId = v.id
      WHERE rv.rfqId = ?
    `).all(id);

    return { ...rfq, lineItems, vendors };
  }

  static findAll(userId, filters = {}) {
    let query = 'SELECT * FROM rfqs WHERE createdBy = ?';
    const params = [userId];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY createdAt DESC';
    const stmt = db.prepare(query);
    return stmt.all(...params);
  }

  static updateStatus(id, status) {
    const stmt = db.prepare('UPDATE rfqs SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(status, id);
    return this.findById(id);
  }

  static getStats(userId) {
    const total = db.prepare('SELECT COUNT(*) as count FROM rfqs WHERE createdBy = ?').get(userId);
    const draft = db.prepare('SELECT COUNT(*) as count FROM rfqs WHERE createdBy = ? AND status = ?').get(userId, 'Draft');
    const sent = db.prepare('SELECT COUNT(*) as count FROM rfqs WHERE createdBy = ? AND status = ?').get(userId, 'Sent');
    const approved = db.prepare('SELECT COUNT(*) as count FROM rfqs WHERE createdBy = ? AND status = ?').get(userId, 'Approved');

    return {
      total: total.count,
      draft: draft.count,
      sent: sent.count,
      approved: approved.count,
    };
  }
}

module.exports = RFQ;
