const db = require('../database');
const bcryptjs = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class User {
  static create(userData) {
    const { firstName, lastName, email, phone, country, additionalInfo, role, password, photo } = userData;
    
    const id = uuidv4();
    const passwordHash = bcryptjs.hashSync(password, 10);
    
    try {
      const stmt = db.prepare(`
        INSERT INTO users (id, firstName, lastName, email, phone, country, additionalInfo, role, password_hash, photo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(id, firstName, lastName, email.toLowerCase(), phone, country, additionalInfo || '', role, passwordHash, photo || null);
      
      return this.findById(id);
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return null; // Email already exists
      }
      throw err;
    }
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = stmt.get(id);
    return user ? this.sanitize(user) : null;
  }

  static findByEmail(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email.toLowerCase());
  }

  static authenticate(email, password) {
    const user = this.findByEmail(email);
    
    if (!user) {
      return null;
    }

    const isValid = bcryptjs.compareSync(password, user.password_hash);
    
    return isValid ? this.sanitize(user) : null;
  }

  static sanitize(user) {
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }

  static update(id, updates) {
    const allowedFields = ['firstName', 'lastName', 'phone', 'country', 'additionalInfo', 'role', 'photo'];
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
      UPDATE users SET ${fields}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?
    `);
    
    stmt.run(...values, id);
    return this.findById(id);
  }
}

module.exports = User;
