const db = require('../database');
const { v4: uuidv4 } = require('uuid');

class ActivityLog {
  static log(userId, action, entityType, entityId, oldValue = null, newValue = null, ipAddress = null) {
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO activity_logs (id, userId, action, entityType, entityId, oldValue, newValue, ipAddress)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      userId,
      action,
      entityType,
      entityId,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      ipAddress || null
    );

    return id;
  }

  static findAll(filters = {}) {
    let query = 'SELECT * FROM activity_logs WHERE 1=1';
    const params = [];

    if (filters.userId) {
      query += ' AND userId = ?';
      params.push(filters.userId);
    }

    if (filters.entityType) {
      query += ' AND entityType = ?';
      params.push(filters.entityType);
    }

    if (filters.action) {
      query += ' AND action = ?';
      params.push(filters.action);
    }

    query += ' ORDER BY createdAt DESC LIMIT 100';
    const stmt = db.prepare(query);
    return stmt.all(...params);
  }

  static getRecentActivity(limit = 50) {
    const stmt = db.prepare(`
      SELECT al.*, u.firstName, u.lastName
      FROM activity_logs al
      JOIN users u ON al.userId = u.id
      ORDER BY al.createdAt DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }

  static getActivityByEntity(entityType, entityId) {
    const stmt = db.prepare(`
      SELECT * FROM activity_logs 
      WHERE entityType = ? AND entityId = ?
      ORDER BY createdAt DESC
    `);
    return stmt.all(entityType, entityId);
  }
}

module.exports = ActivityLog;
