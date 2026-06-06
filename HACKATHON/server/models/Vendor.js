const db = require('../database');
const { v4: uuidv4 } = require('uuid');

class Vendor {
  static create(vendorData) {
    const { name, category, gst, contact, status } = vendorData;
    const id = uuidv4();
    
    try {
      const stmt = db.prepare(`
        INSERT INTO vendors (id, name, category, gst, contact, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(id, name, category, gst, contact, status || 'Active');
      return this.findById(id);
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return null; // GST already exists
      }
      throw err;
    }
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM vendors WHERE id = ?');
    return stmt.get(id);
  }

  static findAll(filters = {}) {
    let query = 'SELECT * FROM vendors WHERE 1=1';
    const params = [];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.search) {
      query += ' AND (name LIKE ? OR category LIKE ? OR gst LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY createdAt DESC';
    const stmt = db.prepare(query);
    return stmt.all(...params);
  }

  static update(id, updates) {
    const allowedFields = ['name', 'category', 'contact', 'status'];
    const validUpdates = {};
    
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        validUpdates[key] = updates[key];
      }
    });

    if (Object.keys(validUpdates).length === 0) return this.findById(id);

    const fields = Object.keys(validUpdates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(validUpdates);
    
    const stmt = db.prepare(`
      UPDATE vendors SET ${fields}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?
    `);
    
    stmt.run(...values, id);
    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM vendors WHERE id = ?');
    stmt.run(id);
    return true;
  }

  static getStats() {
    const total = db.prepare('SELECT COUNT(*) as count FROM vendors').get();
    const active = db.prepare('SELECT COUNT(*) as count FROM vendors WHERE status = ?').get('Active');
    const pending = db.prepare('SELECT COUNT(*) as count FROM vendors WHERE status = ?').get('Pending');
    const blocked = db.prepare('SELECT COUNT(*) as count FROM vendors WHERE status = ?').get('Blocked');

    return {
      total: total.count,
      active: active.count,
      pending: pending.count,
      blocked: blocked.count,
    };
  }
}

module.exports = Vendor;
