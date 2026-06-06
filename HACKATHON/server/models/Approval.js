const db = require('../database');
const { v4: uuidv4 } = require('uuid');

class Approval {
  static create(rfqId, quotationId) {
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO approvals (id, rfqId, quotationId, currentStep, maxSteps, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, rfqId, quotationId, 1, 4, 'Pending');

    // Create approval chain entries (L1 and L2 approvers)
    const approvers = [
      { role: 'Procurement Officer', name: 'Rahul Mehta' },
      { role: 'Finance Manager', name: 'Priya Shah' },
    ];

    const chainStmt = db.prepare(`
      INSERT INTO approval_chain (id, approvalId, approverId, approverRole, status)
      VALUES (?, ?, ?, ?, ?)
    `);

    // For demo: use first two users or create placeholder entries
    approvers.forEach(approver => {
      chainStmt.run(uuidv4(), id, uuidv4(), approver.role, 'Awaiting');
    });

    return this.findById(id);
  }

  static findById(id) {
    const approval = db.prepare('SELECT * FROM approvals WHERE id = ?').get(id);
    if (!approval) return null;

    const chain = db.prepare(`
      SELECT ac.*, u.firstName, u.lastName, u.role
      FROM approval_chain ac
      LEFT JOIN users u ON ac.approverId = u.id
      WHERE ac.approvalId = ?
    `).all(id);

    return { ...approval, chain };
  }

  static findByRFQ(rfqId) {
    return db.prepare('SELECT * FROM approvals WHERE rfqId = ?').get(rfqId);
  }

  static updateStep(id, newStep) {
    const stmt = db.prepare('UPDATE approvals SET currentStep = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(newStep, id);
    return this.findById(id);
  }

  static updateChainStatus(approvalId, approverId, status, remarks) {
    const stmt = db.prepare(`
      UPDATE approval_chain 
      SET status = ?, remarks = ?, approvedAt = CURRENT_TIMESTAMP
      WHERE approvalId = ? AND approverId = ?
    `);
    stmt.run(status, remarks || null, approvalId, approverId);
  }

  static updateStatus(id, status) {
    const stmt = db.prepare('UPDATE approvals SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(status, id);
    return this.findById(id);
  }

  static canApprove(approvalId) {
    const approval = db.prepare('SELECT currentStep, maxSteps FROM approvals WHERE id = ?').get(approvalId);
    return approval && approval.currentStep <= approval.maxSteps;
  }
}

module.exports = Approval;
