const db = require('../database');
const { v4: uuidv4 } = require('uuid');

class Quotation {
  static create(quotationData) {
    const { rfqId, vendorId, totalPrice, gstPercent, deliveryDays, paymentTerms, vendorRating } = quotationData;
    const id = uuidv4();
    const basePrice = Number(totalPrice);
    const gstRate = gstPercent === undefined || gstPercent === null || gstPercent === ''
      ? 18
      : Number(gstPercent);
    const delivery = deliveryDays === undefined || deliveryDays === null || deliveryDays === ''
      ? null
      : Number(deliveryDays);
    const rating = vendorRating === undefined || vendorRating === null || vendorRating === ''
      ? null
      : Number(vendorRating);

    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      throw new Error('Total price must be a positive number');
    }

    if (!Number.isFinite(gstRate) || gstRate < 0) {
      throw new Error('GST percent must be a valid non-negative number');
    }

    if (delivery !== null && (!Number.isInteger(delivery) || delivery <= 0)) {
      throw new Error('Delivery days must be a positive whole number');
    }

    if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 5)) {
      throw new Error('Vendor rating must be between 0 and 5');
    }

    const gstAmount = Number(((basePrice * gstRate) / 100).toFixed(2));
    const finalPrice = Number((basePrice + gstAmount).toFixed(2));

    const stmt = db.prepare(`
      INSERT INTO quotations (id, rfqId, vendorId, totalPrice, gstPercent, gstAmount, finalPrice, deliveryDays, paymentTerms, vendorRating, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, rfqId, vendorId, basePrice, gstRate, gstAmount, finalPrice, delivery, paymentTerms || '', rating, 'Submitted');

    return this.findById(id);
  }

  static findById(id) {
    const stmt = db.prepare(`
      SELECT q.*, v.name as vendorName, v.gst as vendorGST
      FROM quotations q
      JOIN vendors v ON q.vendorId = v.id
      WHERE q.id = ?
    `);
    return stmt.get(id);
  }

  static findByRFQ(rfqId) {
    const stmt = db.prepare(`
      SELECT q.*, v.name as vendorName, v.category, v.gst
      FROM quotations q
      JOIN vendors v ON q.vendorId = v.id
      WHERE q.rfqId = ?
      ORDER BY q.totalPrice ASC
    `);
    return stmt.all(rfqId);
  }

  static updateStatus(id, status) {
    const stmt = db.prepare('UPDATE quotations SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?');
    const result = stmt.run(status, id);
    if (result.changes === 0) return null;
    return this.findById(id);
  }

  static getLowestPrice(rfqId) {
    const stmt = db.prepare(`
      SELECT q.*, v.name as vendorName
      FROM quotations q
      JOIN vendors v ON q.vendorId = v.id
      WHERE q.rfqId = ?
      ORDER BY q.totalPrice ASC
      LIMIT 1
    `);
    return stmt.get(rfqId);
  }
}

module.exports = Quotation;
