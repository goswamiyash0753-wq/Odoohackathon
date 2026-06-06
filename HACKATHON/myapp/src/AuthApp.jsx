/**
 * AuthApp.jsx — Single-file Auth System
 * Screens exactly as per blueprint:
 *   Screen 1 (Login):        Photo · Username · Password · Login button
 *   Screen 2 (Registration): Photo · First Name · Last Name · Email · Phone · Country · Additional Info · Register button
 *
 * Stack: React frontend · in-memory SQLite-style DB (swap DB layer for better-sqlite3 + Express)
 */

import { useState, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────
// LOCAL STORAGE DATABASE
// VendorBridge runs fully in-browser without any external API.
// All data persistence is managed through localStorage, making the
// app deployable as a static site while keeping the existing UI.
// ─────────────────────────────────────────────────────────────────
const storage = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

const DB = (() => {
  const KEYS = {
    USERS: "px_users",
    VENDORS: "px_vendors",
    RFQS: "px_rfqs",
    QUOTATIONS: "px_quotations",
    APPROVALS: "px_approvals",
    POS: "px_purchase_orders",
    INVOICES: "px_invoices",
    ACTIVITY: "px_activity",
    RESETS: "px_resets",
  };

  let users = storage.get(KEYS.USERS, []);
  let vendors = storage.get(KEYS.VENDORS, []);
  let rfqs = storage.get(KEYS.RFQS, []);
  let quotations = storage.get(KEYS.QUOTATIONS, []);
  let approvals = storage.get(KEYS.APPROVALS, []);
  let purchaseOrders = storage.get(KEYS.POS, []);
  let invoices = storage.get(KEYS.INVOICES, []);
  let activity = storage.get(KEYS.ACTIVITY, []);
  let resets = storage.get(KEYS.RESETS, {});

  const persist = () => {
    storage.set(KEYS.USERS, users);
    storage.set(KEYS.VENDORS, vendors);
    storage.set(KEYS.RFQS, rfqs);
    storage.set(KEYS.QUOTATIONS, quotations);
    storage.set(KEYS.APPROVALS, approvals);
    storage.set(KEYS.POS, purchaseOrders);
    storage.set(KEYS.INVOICES, invoices);
    storage.set(KEYS.ACTIVITY, activity);
    storage.set(KEYS.RESETS, resets);
  };

  const hash = (password) => btoa(password + "_salt_v1");
  const verifyHash = (password, hashValue) => hash(password) === hashValue;
  const sanitizeUser = (user) => {
    const safeUser = { ...user };
    delete safeUser.password_hash;
    return safeUser;
  };
  const getNextPoNumber = () => `PO-${String(purchaseOrders.length + 1).padStart(3, "0")}`;
  const getNextInvoiceNumber = () => `INV-${String(invoices.length + 1).padStart(3, "0")}`;

  const recordActivity = (action, detail) => {
    const currentUser = Session?.currentUser ? Session.currentUser() : null;
    activity.unshift({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      user: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "System",
      action,
      detail,
    });
    storage.set(KEYS.ACTIVITY, activity);
  };

  const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const api = {
    create(userData) {
      if (users.find((u) => u.email === userData.email.toLowerCase()))
        return { error: "Email already registered" };

      const user = {
        id: crypto.randomUUID(),
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email.toLowerCase(),
        phone: userData.phone,
        country: userData.country,
        additionalInfo: userData.additionalInfo || "",
        role: userData.role || "",
        password_hash: hash(userData.password),
        photo: userData.photo || null,
        createdAt: new Date().toISOString(),
      };

      users.push(user);
      persist();
      recordActivity("User registered", user.email);
      return { user: sanitizeUser(user) };
    },

    login(username, password) {
      const user = users.find((u) => u.email === username.toLowerCase());
      if (!user) return { error: "No account found" };
      if (!verifyHash(password, user.password_hash)) return { error: "Incorrect password" };
      const token = btoa(JSON.stringify({ uid: user.id, exp: Date.now() + 3600000 }));
      recordActivity("User logged in", user.email);
      return { token, user: sanitizeUser(user) };
    },

    verifyToken(token) {
      try {
        const payload = JSON.parse(atob(token));
        if (payload.exp < Date.now()) return null;
        const user = users.find((u) => u.id === payload.uid);
        return user ? sanitizeUser(user) : null;
      } catch {
        return null;
      }
    },

    generateResetToken(email) {
      const normalizedEmail = email.toLowerCase();
      const user = users.find((u) => u.email === normalizedEmail);
      if (!user) return { error: "No account found" };
      const token = Math.random().toString(36).slice(2, 10).toUpperCase();
      resets[normalizedEmail] = { token, exp: Date.now() + 600000 };
      persist();
      recordActivity("Password reset requested", normalizedEmail);
      return { message: `Reset token: ${token}  (valid 10 min)` };
    },

    resetPassword(email, token, newPassword) {
      const normalizedEmail = email.toLowerCase();
      const entry = resets[normalizedEmail];
      if (!entry || entry.token !== token.toUpperCase() || entry.exp < Date.now())
        return { error: "Invalid or expired token" };
      const user = users.find((u) => u.email === normalizedEmail);
      if (!user) return { error: "User not found" };
      user.password_hash = hash(newPassword);
      delete resets[normalizedEmail];
      persist();
      recordActivity("Password reset", normalizedEmail);
      return { ok: true };
    },

    getVendors() {
      return vendors.slice().sort((a, b) => a.name.localeCompare(b.name));
    },

    getVendorStats() {
      return {
        total: vendors.length,
        active: vendors.filter((v) => v.status === "Active").length,
        pending: vendors.filter((v) => v.status === "Pending").length,
        blocked: vendors.filter((v) => v.status === "Blocked").length,
      };
    },

    addVendor(vendor) {
      const name = String(vendor.name || "").trim();
      const category = String(vendor.category || "").trim();
      const gst = String(vendor.gst || "").trim();
      if (!name || !category || !gst) return { error: "Vendor name, category, and GST are required" };
      if (vendors.some((item) => item.gst.toLowerCase() === gst.toLowerCase())) {
        return { error: "A vendor with this GST number already exists" };
      }
      const record = {
        id: crypto.randomUUID(),
        name,
        category,
        gst,
        contact: vendor.contact || "—",
        status: vendor.status || "Active",
        createdAt: new Date().toISOString(),
      };
      vendors.push(record);
      persist();
      recordActivity("Vendor added", name);
      return record;
    },

    getRFQs(status = null) {
      const list = status && status !== "All"
        ? rfqs.filter((r) => r.status === status)
        : rfqs.slice();
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    getRFQ(id) {
      return rfqs.find((r) => r.id === id) || null;
    },

    createRFQ(data) {
      const cleanLineItems = (data.lineItems || [])
        .map((line) => ({
          item: String(line.item || "").trim(),
          qty: Math.max(1, toNumber(line.qty, 1)),
          unit: String(line.unit || "pcs").trim() || "pcs",
        }))
        .filter((line) => line.item);
      const cleanVendors = Array.from(new Set((data.vendors || [])
        .map((vendor) => String(vendor || "").trim())
        .filter(Boolean)));

      const record = {
        id: crypto.randomUUID(),
        title: String(data.title || "New RFQ").trim() || "New RFQ",
        category: String(data.category || "General").trim() || "General",
        description: data.description || "",
        vendors: cleanVendors,
        attachments: data.attachments || [],
        lineItems: cleanLineItems,
        status: data.status || "Draft",
        createdAt: new Date().toISOString(),
      };
      rfqs.push(record);

      // Auto-generate demo quotations for Open RFQs with vendors
      if (record.status === "Open" && record.vendors.length > 0) {
        const basePrice = 185000;
        record.vendors.forEach((vendorName, index) => {
          const priceVariation = (index - 1) * 10000; // Create price variations
          quotations.push({
            id: crypto.randomUUID(),
            rfqId: record.id,
            vendorName,
            price: basePrice + priceVariation,
            gstPercent: 18,
            deliveryDays: 7 + index * 3,
            rating: Math.max(3.5, 4.8 - index * 0.3),
            paymentTerms: index === 0 ? "30 days" : index === 1 ? "45 days" : "15 days",
            createdAt: new Date().toISOString(),
          });
        });
      }

      persist();
      recordActivity("RFQ created", record.title);
      return record;
    },

    getQuotations(rfqId) {
      return quotations.filter((q) => q.rfqId === rfqId);
    },

    addQuotation(quotation) {
      const price = toNumber(quotation.price ?? quotation.totalPrice, 0);
      const gstPercent = toNumber(quotation.gstPercent, 18);
      const deliveryDays = Math.max(1, toNumber(quotation.deliveryDays, 12));
      const rating = Math.min(5, Math.max(0, toNumber(quotation.rating ?? quotation.vendorRating, 4)));
      const record = {
        id: crypto.randomUUID(),
        rfqId: quotation.rfqId,
        vendorName: quotation.vendorName || "Unknown vendor",
        price,
        gstPercent,
        deliveryDays,
        rating,
        paymentTerms: quotation.paymentTerms || "30 days",
        status: quotation.status || "Submitted",
        createdAt: new Date().toISOString(),
      };
      quotations.push(record);
      persist();
      recordActivity("Quotation recorded", `${record.vendorName} for ${record.rfqId}`);
      return record;
    },

    getApprovals() {
      return approvals.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    getApproval(id) {
      return approvals.find((a) => a.id === id) || null;
    },

    createApproval(rfqId, quotationId) {
      const quotation = quotations.find((q) => q.id === quotationId);
      if (!quotation) return { error: "Quotation not found" };
      const existing = approvals.find((approval) => approval.quotationId === quotationId && approval.status !== "Rejected");
      if (existing) return { approval: existing, error: "Approval already exists for this quotation" };
      const record = {
        id: crypto.randomUUID(),
        rfqId,
        quotationId,
        currentStep: 2,
        maxSteps: 4,
        status: "Pending",
        remarks: "",
        history: [
          { when: new Date().toISOString(), action: "Submitted", remarks: "Approval initiated" },
          { when: new Date().toISOString(), action: "L1 Review", remarks: "Procurement review completed" },
        ],
        createdAt: new Date().toISOString(),
      };
      approvals.push(record);
      persist();
      recordActivity("Approval created", `${quotation.vendorName} for RFQ ${rfqId}`);
      return { approval: record };
    },

    approveApproval(id, remarks = "") {
      const approval = approvals.find((a) => a.id === id);
      if (!approval) return { error: "Approval not found" };
      if (approval.status === "Approved") return { approval };
      approval.status = "Approved";
      approval.remarks = remarks;
      approval.currentStep = approval.maxSteps || 4;
      approval.history.push({ when: new Date().toISOString(), action: "Approved", remarks });
      persist();
      recordActivity("Approval approved", approval.id);
      return { approval };
    },

    rejectApproval(id, remarks = "") {
      const approval = approvals.find((a) => a.id === id);
      if (!approval) return { error: "Approval not found" };
      approval.status = "Rejected";
      approval.remarks = remarks;
      approval.currentStep = approval.maxSteps || 4;
      approval.history.push({ when: new Date().toISOString(), action: "Rejected", remarks });
      persist();
      recordActivity("Approval rejected", approval.id);
      return { approval };
    },

    getPurchaseOrders(status = null) {
      const list = status && status !== "All"
        ? purchaseOrders.filter((po) => po.status === status)
        : purchaseOrders;
      return list.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    createPurchaseOrder(quotationId) {
      const quotation = quotations.find((q) => q.id === quotationId);
      if (!quotation) return { error: "Quotation not found" };
      const existing = purchaseOrders.find((po) => po.quotationId === quotationId);
      if (existing) return { purchaseOrder: existing };
      const amount = toNumber(quotation.price ?? quotation.finalPrice ?? quotation.totalPrice, 0);
      const record = {
        id: crypto.randomUUID(),
        poNumber: getNextPoNumber(),
        quotationId,
        vendorName: quotation.vendorName || quotation.name || "Unknown vendor",
        rfqId: quotation.rfqId,
        amount,
        status: "Approved",
        createdAt: new Date().toISOString(),
      };
      purchaseOrders.push(record);
      persist();
      recordActivity("Purchase order created", record.poNumber);
      return { purchaseOrder: record };
    },

    updatePOStatus(id, status) {
      const order = purchaseOrders.find((po) => po.id === id);
      if (!order) return { error: "PO not found" };
      order.status = status;
      persist();
      recordActivity("Purchase order updated", `${order.poNumber} → ${status}`);
      return { purchaseOrder: order };
    },

    getInvoices(status = null) {
      const list = status && status !== "All"
        ? invoices.filter((inv) => inv.status === status)
        : invoices;
      return list.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    createInvoice(poId, gstPercent = 18, dueDate = null) {
      const po = purchaseOrders.find((p) => p.id === poId);
      if (!po) return { error: "PO not found" };
      if (invoices.find((inv) => inv.poId === poId)) return { error: "Invoice already exists for this PO" };
      const subtotal = toNumber(po.amount, 0);
      const gstRate = toNumber(gstPercent, 18);
      const gst = Math.round((subtotal * gstRate) / 100);
      const total = subtotal + gst;
      const record = {
        id: crypto.randomUUID(),
        invoiceNumber: getNextInvoiceNumber(),
        poId,
        vendorName: po.vendorName,
        amount: subtotal,
        gstPercent: gstRate,
        gstAmount: gst,
        total,
        dueDate: dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        status: "Issued",
        paymentStatus: "Pending",
        createdAt: new Date().toISOString(),
      };
      invoices.push(record);
      persist();
      recordActivity("Invoice created", record.invoiceNumber);
      return { invoice: record };
    },

    updateInvoicePayment(id, paymentStatus) {
      const invoice = invoices.find((inv) => inv.id === id);
      if (!invoice) return { error: "Invoice not found" };
      invoice.paymentStatus = paymentStatus;
      if (paymentStatus === "Paid") invoice.status = "Settled";
      persist();
      recordActivity("Invoice payment updated", `${invoice.invoiceNumber} → ${paymentStatus}`);
      return { invoice };
    },

    getActivity(limit = 50) {
      return activity.slice(0, limit);
    },

    seed() {
      if (!users.length) {
        users.push({
          id: crypto.randomUUID(),
          firstName: "Arjun",
          lastName: "Mehta",
          email: "admin@demo.com",
          phone: "9876543210",
          country: "India",
          additionalInfo: "Procurement Head",
          role: "Admin",
          password_hash: hash("Admin@123"),
          photo: null,
          createdAt: new Date().toISOString(),
        });
      }

      if (!vendors.length) {
        vendors.push(
          { id: crypto.randomUUID(), name: "Infra Supplies Pvt Ltd", category: "Construction", gst: "22A@BCSM*0", contact: "412 #vendor", status: "Active", createdAt: new Date().toISOString() },
          { id: crypto.randomUUID(), name: "Tech Core LTD", category: "IT", gst: "22A@BCSM2", contact: "412 #vendor", status: "Active", createdAt: new Date().toISOString() },
          { id: crypto.randomUUID(), name: "Fleeting Transport", category: "Logistics", gst: "22A@BCSM3bc", contact: "—", status: "Pending", createdAt: new Date().toISOString() },
          { id: crypto.randomUUID(), name: "Office Need Co.", category: "Furniture", gst: "22A@BCSM4", contact: "412 #vendor", status: "Active", createdAt: new Date().toISOString() },
        );
      }

      if (!rfqs.length) {
        const rfqId = crypto.randomUUID();
        rfqs.push({
          id: rfqId,
          title: "Office Furniture procurement Q2",
          category: "Furniture",
          description: "Ergonomic chairs and Standing desks for 2nd floor",
          vendors: ["Infra Supplies Pvt Ltd", "Tech Core LTD", "Office Need Co."],
          attachments: [],
          lineItems: [
            { item: "Ergonomic chair", qty: 20, unit: "pcs" },
            { item: "Standing desks", qty: 10, unit: "pcs" },
          ],
          status: "Open",
          createdAt: new Date().toISOString(),
        });
      }

      // Ensure quotations exist for all RFQs
      rfqs.forEach((rfq) => {
        const existingQuotes = quotations.filter((q) => q.rfqId === rfq.id);
        if (existingQuotes.length === 0 && rfq.vendors.length > 0) {
          const basePrice = 185000;
          rfq.vendors.forEach((vendorName, index) => {
            const priceVariation = (index - 1) * 10000;
            quotations.push({
              id: crypto.randomUUID(),
              rfqId: rfq.id,
              vendorName,
              price: basePrice + priceVariation,
              gstPercent: 18,
              deliveryDays: 7 + index * 3,
              rating: Math.max(3.5, 4.8 - index * 0.3),
              paymentTerms: index === 0 ? "30 days" : index === 1 ? "45 days" : "15 days",
              createdAt: new Date().toISOString(),
            });
          });
        }
      });

      if (!approvals.length && quotations.length) {
        approvals.push({
          id: crypto.randomUUID(),
          rfqId: rfqs[0]?.id || "",
          quotationId: quotations[0]?.id || "",
          status: "Pending",
          remarks: "",
          history: [{ when: new Date().toISOString(), action: "Submitted", remarks: "Approval started" }],
          createdAt: new Date().toISOString(),
        });
      }

      if (!purchaseOrders.length && approvals.length) {
        purchaseOrders.push({
          id: crypto.randomUUID(),
          poNumber: getNextPoNumber(),
          quotationId: approvals[0].quotationId,
          vendorName: "Infra Supplies Pvt Ltd",
          rfqId: approvals[0].rfqId,
          amount: 185000,
          status: "Approved",
          createdAt: new Date().toISOString(),
        });
      }

      if (!invoices.length && purchaseOrders.length) {
        invoices.push({
          id: crypto.randomUUID(),
          invoiceNumber: getNextInvoiceNumber(),
          poId: purchaseOrders[0].id,
          vendorName: purchaseOrders[0].vendorName,
          amount: purchaseOrders[0].amount,
          gstPercent: 18,
          gstAmount: Math.round((purchaseOrders[0].amount * 18) / 100),
          total: Math.round(purchaseOrders[0].amount * 1.18),
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
          status: "Issued",
          paymentStatus: "Pending",
          createdAt: new Date().toISOString(),
        });
      }

      if (!activity.length) {
        activity.push({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          user: "System",
          action: "Seed data created",
          detail: "Initial vendor, RFQ, quotation, approval, PO, and invoice seed data",
        });
      }

      persist();
    },
  };

  return api;
})();

const Session = {
  save: (token) => localStorage.setItem("px_token", token),
  get: () => localStorage.getItem("px_token"),
  clear: () => localStorage.removeItem("px_token"),
  currentUser: () => {
    const token = Session.get();
    return token ? DB.verifyToken(token) : null;
  },
};

DB.seed();

// ─────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────
const V = {
  required: (v, label) => v.trim() ? "" : `${label} is required`,
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "Enter a valid email",
  password: (v) =>
    v.length < 8 ? "Min 8 characters" :
    !/[A-Z]/.test(v) ? "Need at least 1 uppercase letter" :
    !/[0-9]/.test(v) ? "Need at least 1 number" : "",
  phone: (v) => /^\d{10}$/.test(v) ? "" : "Enter a valid 10-digit phone number",
};

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0e0f14; --surface: #161820; --surface2: #1e2028;
    --border: rgba(255,255,255,0.09); --text: #eef0f6; --muted: #7a8396;
    --accent: #63b3ed; --danger: #fc8181; --success: #68d391;
  }
  body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; min-height: 100vh; }
  .app { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem 1rem; }

  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 2rem; width: 300px; }
  .card-wide { width: 380px; }
  .screen-label { font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 1.5rem; padding-bottom: .75rem; border-bottom: 1px solid var(--border); }

  /* Photo circle — matches blueprint center circle */
  .photo-circle { width: 80px; height: 80px; border-radius: 50%; border: 2px solid var(--border); background: var(--surface2); display: flex; align-items: center; justify-content: center; margin: 0 auto .5rem; cursor: pointer; overflow: hidden; transition: border-color .2s; }
  .photo-circle:hover { border-color: var(--accent); }
  .photo-circle img { width: 100%; height: 100%; object-fit: cover; }
  .photo-label { font-size: 12px; color: var(--muted); text-align: center; margin-bottom: 1.5rem; }

  /* Fields */
  .field { margin-bottom: .9rem; }
  .field input, .field textarea { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: .65rem .9rem; color: var(--text); font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; transition: border-color .2s; resize: none; }
  .field input:focus, .field textarea:focus { border-color: rgba(99,179,237,.5); }
  .field input.err { border-color: var(--danger); }
  .field input::placeholder, .field textarea::placeholder { color: var(--muted); }
  .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .field-err { font-size: 11px; color: var(--danger); margin-top: 3px; }

  /* Password wrapper */
  .pwrap { position: relative; }
  .pwrap input { padding-right: 2.2rem; }
  .eye { position: absolute; right: .65rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--muted); font-size: 13px; padding: 0; line-height: 1; }

  /* Buttons */
  .btn { width: 100%; padding: .7rem; border: none; border-radius: 8px; font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; cursor: pointer; transition: opacity .15s, transform .1s; letter-spacing: .3px; margin-top: .5rem; }
  .btn:active { transform: scale(.98); }
  .btn:disabled { opacity: .5; cursor: not-allowed; }
  .btn-login { background: linear-gradient(135deg, #63b3ed, #b794f4); color: #0e0f14; }
  .btn-register { background: linear-gradient(135deg, #68d391, #63b3ed); color: #0e0f14; }
  .btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }

  /* Alerts */
  .alert { padding: .6rem .85rem; border-radius: 7px; font-size: 12px; margin-bottom: .9rem; display: flex; gap: 6px; }
  .alert-error { background: rgba(252,129,129,.1); border: 1px solid rgba(252,129,129,.2); color: var(--danger); }
  .alert-success { background: rgba(104,211,145,.1); border: 1px solid rgba(104,211,145,.2); color: var(--success); }
  .alert-info { background: rgba(99,179,237,.1); border: 1px solid rgba(99,179,237,.15); color: var(--accent); font-size: 11px; }

  .link { background: none; border: none; color: var(--accent); font-size: 12px; cursor: pointer; padding: 0; font-family: 'DM Sans', sans-serif; text-decoration: underline; text-underline-offset: 2px; }
  .switch { text-align: center; font-size: 12px; color: var(--muted); margin-top: 1rem; }

  /* ── Main Landing (Screen 3) ── */
  .ml-wrap { display: flex; flex-direction: column; width: 100vw; min-height: 100vh; background: var(--bg); }

  /* top bar */
  .ml-topbar { display: flex; align-items: center; justify-content: space-between; padding: .7rem 1.4rem; background: var(--surface); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .ml-brand { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 800; color: var(--text); }
  .ml-user-pill { background: #6c3fc5; border-radius: 999px; padding: .35rem .9rem; font-size: 12px; font-weight: 600; color: #fff; }
  .ml-avatar-circle { width: 32px; height: 32px; border-radius: 50%; background: var(--surface2); border: 2px solid var(--border); overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; cursor: pointer; }
  .ml-avatar-circle img { width: 100%; height: 100%; object-fit: cover; }

  /* body = sidebar + content */
  .ml-body { display: flex; flex: 1; overflow: hidden; }

  /* sidebar */
  .ml-sidebar { width: 200px; flex-shrink: 0; background: var(--surface); border-right: 1px solid var(--border); padding: 1rem 0; display: flex; flex-direction: column; gap: 2px; }
  .ml-nav-item { padding: .6rem 1.2rem; font-size: 13px; color: var(--muted); cursor: pointer; border-radius: 6px; margin: 0 .5rem; transition: background .15s, color .15s; }
  .ml-nav-item:hover { background: var(--surface2); color: var(--text); }
  .ml-nav-item.active { background: #1a4731; color: #68d391; font-weight: 600; }

  /* main content */
  .ml-content { flex: 1; padding: 1.8rem 2rem; overflow-y: auto; }
  .ml-page-title { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; margin-bottom: .25rem; }
  .ml-page-sub { font-size: 13px; color: var(--muted); margin-bottom: 1.5rem; }

  /* stat cards */
  .ml-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.8rem; }
  .ml-stat { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.2rem; }
  .ml-stat-val { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; }
  .ml-stat-lbl { font-size: 11px; color: var(--muted); margin-top: 4px; }

  /* bottom section: table + chart side by side */
  .ml-bottom { display: grid; grid-template-columns: 1fr auto; gap: 1.5rem; margin-bottom: 1.8rem; }
  .ml-table-box { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; }
  .ml-table-title { font-size: 12px; color: var(--muted); font-weight: 600; margin-bottom: .75rem; }
  .ml-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .ml-table th { text-align: left; color: var(--muted); padding: .3rem .5rem; border-bottom: 1px solid var(--border); font-weight: 500; }
  .ml-table td { padding: .4rem .5rem; border-bottom: 1px solid var(--border); }
  .ml-table tr:last-child td { border-bottom: none; }
  .ml-status { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 11px; }
  .ml-status.approved { background: rgba(104,211,145,.15); color: #68d391; }
  .ml-status.pending  { background: rgba(99,179,237,.15);  color: #63b3ed; }
  .ml-status.draft    { background: rgba(122,131,150,.15); color: var(--muted); }

  /* chart placeholder */
  .ml-chart-box { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; width: 180px; flex-shrink: 0; }
  .ml-chart-title { font-size: 11px; color: var(--muted); margin-bottom: .6rem; }
  .ml-chart-img { width: 100%; height: 120px; border-radius: 8px; background: var(--surface2); display: flex; align-items: center; justify-content: center; }

  /* divider */
  .ml-divider { border: none; border-top: 1px solid var(--border); margin: .5rem 0 1.2rem; }

  /* action buttons */
  .ml-actions { display: flex; gap: .75rem; }
  .ml-action-btn { padding: .5rem 1.1rem; border: 1px solid var(--border); border-radius: 8px; background: transparent; color: var(--text); font-size: 12px; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: border-color .15s, background .15s; }
  .ml-action-btn:hover { border-color: var(--accent); background: rgba(99,179,237,.07); }

  /* ── Vendors Page ── */
  .vp-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: .4rem; }
  .vp-sub { font-size: 12px; color: var(--muted); margin-bottom: 1.2rem; }
  .vp-search { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: .6rem .9rem; color: var(--text); font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; margin-bottom: 1rem; }
  .vp-search:focus { border-color: rgba(99,179,237,.5); }
  .vp-search::placeholder { color: var(--muted); }
  .vp-tabs { display: flex; gap: .5rem; margin-bottom: 1rem; }
  .vp-tab { padding: .3rem .8rem; border-radius: 6px; font-size: 12px; cursor: pointer; border: 1px solid var(--border); background: transparent; color: var(--muted); transition: all .15s; }
  .vp-tab.active { background: #1a4731; color: #68d391; border-color: transparent; font-weight: 600; }
  .vp-tab:hover:not(.active) { background: var(--surface2); color: var(--text); }
  .vp-add-btn { padding: .4rem .9rem; border: 1px solid var(--accent); border-radius: 8px; background: transparent; color: var(--accent); font-size: 12px; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: background .15s; white-space: nowrap; }
  .vp-add-btn:hover { background: rgba(99,179,237,.1); }
  .vp-table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .vp-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .vp-table th { text-align: left; color: var(--muted); padding: .55rem .8rem; border-bottom: 1px solid var(--border); font-weight: 500; background: var(--surface); }
  .vp-table td { padding: .55rem .8rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
  .vp-table tr:last-child td { border-bottom: none; }
  .vp-table tr:hover td { background: rgba(255,255,255,.02); }
  .vp-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; }
  .vp-badge.active  { background: rgba(104,211,145,.15); color: #68d391; }
  .vp-badge.pending { background: rgba(99,179,237,.15);  color: #63b3ed; }
  .vp-badge.blocked { background: rgba(252,129,129,.15); color: #fc8181; }
  .vp-view-btn { padding: 2px 10px; border: 1px solid var(--border); border-radius: 6px; background: transparent; color: var(--text); font-size: 11px; cursor: pointer; transition: border-color .15s; }
  .vp-view-btn:hover { border-color: var(--accent); color: var(--accent); }

  /* ── RFQ Page ── */
  .rfq-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem; }
  .rfq-col { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem; }
  .rfq-col-title { font-size: 11px; color: var(--muted); font-weight: 600; margin-bottom: .9rem; text-transform: uppercase; letter-spacing: .8px; }
  .rfq-step-bar { display: flex; align-items: center; gap: .4rem; margin-bottom: 1.2rem; }
  .rfq-step { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; border: 2px solid var(--border); color: var(--muted); }
  .rfq-step.done { background: #68d391; border-color: #68d391; color: #0e0f14; }
  .rfq-step.current { border-color: #63b3ed; color: #63b3ed; }
  .rfq-step-line { flex: 1; height: 2px; background: var(--border); border-radius: 2px; }
  .rfq-step-line.done { background: #68d391; }
  .rfq-field { margin-bottom: .75rem; }
  .rfq-field label { display: block; font-size: 11px; color: var(--muted); margin-bottom: .3rem; }
  .rfq-field input, .rfq-field textarea, .rfq-field select { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 7px; padding: .5rem .75rem; color: var(--text); font-size: 12px; font-family: 'DM Sans', sans-serif; outline: none; transition: border-color .2s; resize: none; }
  .rfq-field input:focus, .rfq-field textarea:focus, .rfq-field select:focus { border-color: rgba(99,179,237,.5); }
  .rfq-field input::placeholder, .rfq-field textarea::placeholder { color: var(--muted); }
  .rfq-field select option { background: var(--surface2); }
  .rfq-line-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: .6rem; }
  .rfq-line-table th { text-align: left; color: var(--muted); padding: .25rem .4rem; border-bottom: 1px solid var(--border); font-weight: 500; }
  .rfq-line-table td { padding: .3rem .4rem; border-bottom: 1px solid var(--border); }
  .rfq-line-table tr:last-child td { border-bottom: none; }
  .rfq-vendor-tag { display: flex; align-items: center; justify-content: space-between; background: var(--surface2); border-radius: 6px; padding: .3rem .6rem; font-size: 12px; margin-bottom: .4rem; }
  .rfq-vendor-tag button { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 14px; line-height: 1; padding: 0; }
  .rfq-vendor-tag button:hover { color: var(--danger); }
  .rfq-add-vendor-btn { background: none; border: none; color: var(--accent); font-size: 12px; cursor: pointer; padding: 0; font-family: 'DM Sans', sans-serif; text-decoration: underline; text-underline-offset: 2px; }
  .rfq-drop-zone { border: 1.5px dashed var(--border); border-radius: 8px; padding: 1.5rem; text-align: center; font-size: 12px; color: var(--muted); cursor: pointer; transition: border-color .2s; }
  .rfq-drop-zone:hover { border-color: var(--accent); color: var(--accent); }
  .rfq-btns { display: flex; gap: .6rem; margin-top: .8rem; }
  .rfq-btn { flex: 1; padding: .5rem; border: 1px solid var(--border); border-radius: 7px; background: transparent; color: var(--text); font-size: 12px; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all .15s; }
  .rfq-btn:hover { border-color: var(--accent); background: rgba(99,179,237,.07); }
  .rfq-btn.primary { background: linear-gradient(135deg, #68d391, #63b3ed); border-color: transparent; color: #0e0f14; font-weight: 600; }
  .rfq-btn.primary:hover { opacity: .9; }

  /* Quotation Comparison Page Styles */
  .comp-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1rem 0;
  }
  .comp-subtitle {
    font-size: 14px;
    color: var(--muted);
    margin-top: 4px;
    font-weight: 500;
  }
  .comp-table-wrapper {
    margin-top: 1.5rem;
    overflow-x: auto;
  }
  .comp-matrix-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid var(--border);
  }
  .comp-matrix-table th, .comp-matrix-table td {
    padding: 1.2rem;
    font-size: 13px;
    text-align: center;
    border: 1px solid var(--border);
  }
  .comp-matrix-table th {
    font-weight: 600;
    color: var(--muted);
    background: rgba(255, 255, 255, 0.02);
  }
  .comp-matrix-table td.criteria-label {
    text-align: left;
    font-weight: 600;
    color: var(--muted);
    background: rgba(255, 255, 255, 0.01);
    width: 25%;
  }
  .comp-col-highlight {
    background: #072b1a !important; /* solid green box matching sidebar active */
    border: 2px dashed #68d391 !important;
    color: var(--text);
  }
  .comp-btn-select {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text);
    padding: 0.5rem 2rem;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    max-width: 140px;
  }
  .comp-btn-select:hover {
    border-color: var(--text);
  }
  .comp-btn-approve {
    background: #68d391;
    border: 1px solid #68d391;
    color: #0e0f14;
    padding: 0.5rem 2rem;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    max-width: 140px;
  }
  .comp-btn-approve:hover {
    opacity: 0.9;
  }
  .comp-legend {
    font-size: 12px;
    color: var(--danger); /* red text legend */
    margin-top: 1rem;
    font-style: italic;
  }

  /* ── Approvals Page ── */
  .ap-wrap { display: flex; flex-direction: column; gap: 1.5rem; }
  .ap-sub { font-size: 13px; color: var(--muted); margin-top: 3px; margin-bottom: 1.2rem; font-weight: 500; }

  /* Progress stepper */
  .ap-stepper { display: flex; align-items: center; margin-bottom: 1.6rem; }
  .ap-step-node { display: flex; flex-direction: column; align-items: center; gap: 5px; min-width: 60px; }
  .ap-step-circle { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; border: 2px solid var(--border); color: var(--muted); background: var(--surface2); transition: all .2s; }
  .ap-step-circle.done { background: #1a4731; border-color: #68d391; color: #68d391; }
  .ap-step-circle.current { background: #7c5c1a; border-color: #f6ad55; color: #f6ad55; }
  .ap-step-label { font-size: 10px; color: var(--muted); text-align: center; white-space: nowrap; }
  .ap-step-label.current { color: #f6ad55; font-weight: 600; }
  .ap-step-connector { flex: 1; height: 2px; background: var(--border); border-radius: 2px; margin: 0 4px; margin-bottom: 18px; }
  .ap-step-connector.done { background: #68d391; }

  /* Two-column body */
  .ap-body { display: grid; grid-template-columns: 1fr 1fr; gap: 1.4rem; }

  /* Approval chain */
  .ap-chain-box { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem; }
  .ap-chain-title { font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .8px; margin-bottom: 1rem; }
  .ap-chain-item { display: flex; align-items: flex-start; gap: .75rem; padding: .75rem 0; border-bottom: 1px solid var(--border); }
  .ap-chain-item:last-child { border-bottom: none; }
  .ap-chain-icon { width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 14px; }
  .ap-chain-icon.approved { border-color: #68d391; background: rgba(104,211,145,.1); }
  .ap-chain-icon.awaiting { border-color: #63b3ed; background: rgba(99,179,237,.1); }
  .ap-chain-name { font-size: 13px; font-weight: 600; color: var(--text); }
  .ap-chain-role { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .ap-chain-status { font-size: 11px; margin-top: 3px; }
  .ap-chain-status.approved { color: #68d391; }
  .ap-chain-status.awaiting { color: #63b3ed; }

  /* Remarks */
  .ap-remarks { margin-top: 1rem; }
  .ap-remarks-label { font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .8px; margin-bottom: .5rem; }
  .ap-remarks-input { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: .75rem .9rem; color: var(--text); font-size: 12px; font-family: 'DM Sans', sans-serif; outline: none; resize: none; transition: border-color .2s; }
  .ap-remarks-input:focus { border-color: rgba(99,179,237,.5); }
  .ap-remarks-input::placeholder { color: var(--muted); }

  /* Action buttons */
  .ap-action-row { display: flex; gap: .75rem; margin-top: 1rem; }
  .ap-btn-approve { flex: 1; padding: .6rem 0; background: #1a4731; border: 1px solid #68d391; border-radius: 8px; color: #68d391; font-size: 13px; font-weight: 700; font-family: 'Syne', sans-serif; cursor: pointer; transition: all .15s; }
  .ap-btn-approve:hover { background: rgba(104,211,145,.2); }
  .ap-btn-reject { flex: 1; padding: .6rem 0; background: transparent; border: 1px solid var(--danger); border-radius: 8px; color: var(--danger); font-size: 13px; font-weight: 700; font-family: 'Syne', sans-serif; cursor: pointer; transition: all .15s; }
  .ap-btn-reject:hover { background: rgba(252,129,129,.1); }

  /* Quotation summary card */
  .ap-quote-box { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem; display: flex; flex-direction: column; gap: .5rem; }
  .ap-quote-title { font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .8px; margin-bottom: .4rem; }
  .ap-quote-row { display: flex; justify-content: space-between; padding: .4rem 0; border-bottom: 1px solid rgba(255,255,255,.05); font-size: 13px; }
  .ap-quote-row:last-child { border-bottom: none; }
  .ap-quote-lbl { color: var(--muted); }
  .ap-quote-val { color: var(--text); font-weight: 500; }

  /* Modal Overlay & Card Styles */
  .portal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 1rem;
  }
  .portal-modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.5rem;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
  }
  .portal-modal-title {
    font-family: 'Syne', sans-serif;
    font-size: 18px;
    font-weight: 800;
    margin-bottom: 1.2rem;
    color: var(--text);
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.5rem;
  }
  .portal-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 1.2rem;
  }
  .portal-modal-btn {
    padding: 0.5rem 1rem;
    font-size: 12px;
    border-radius: 6px;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .portal-modal-btn-submit {
    background: #68d391;
    color: #0e0f14;
  }
  .portal-modal-btn-submit:hover {
    opacity: 0.9;
  }
  .portal-detail-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    font-size: 13px;
  }
  .portal-detail-row:last-child {
    border-bottom: none;
  }
  .portal-detail-lbl {
    color: var(--muted);
  }
  .portal-detail-val {
    font-weight: 500;
    color: var(--text);
  }
`;


// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
function Alert({ type, children }) {
  return <div className={`alert alert-${type}`}><span>{type === "error" ? "⚠" : "✓"}</span><span>{children}</span></div>;
}

function PhotoCircle({ preview, onChange }) {
  return (
    <label style={{ display: "block" }}>
      <div className="photo-circle">
        {preview
          ? <img src={preview} alt="profile" />
          : <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--muted)" }}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        }
      </div>
      <div className="photo-label">Photo</div>
      <input type="file" accept="image/*" style={{ display: "none" }} onChange={onChange} />
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────
// SCREEN 1 — LOGIN
// Fields: Photo · Username · Password · Login button
// ─────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, onSignup, onForgot }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePhoto = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target.result);
    reader.readAsDataURL(f);
  };

  const handleLogin = () => {
    setError("");
    if (!username.trim()) { setError("Username is required"); return; }
    if (!password) { setError("Password is required"); return; }
    setLoading(true);
    setTimeout(() => {
      const res = DB.login(username, password);
      if (res.error) { setError(res.error); setLoading(false); }
      else { Session.save(res.token); onLogin(res.user); }
    }, 500);
  };

  return (
    <div className="card">
      <div className="screen-label">Login Screen  (Screen 1)</div>
      {error && <Alert type="error">{error}</Alert>}

      <PhotoCircle preview={photo} onChange={handlePhoto} />

      <div className="field">
        <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
      </div>

      <div className="field">
        <div className="pwrap">
          <input type={showPwd ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="button" className="eye" onClick={() => setShowPwd(s => !s)}>{showPwd ? "🙈" : "👁"}</button>
        </div>
      </div>

      <div style={{ textAlign: "right", marginBottom: ".25rem" }}>
        <button className="link" onClick={onForgot}>Forgot password?</button>
      </div>

      <button className="btn btn-login" disabled={loading} onClick={handleLogin}>
        {loading ? "Logging in…" : "Login"}
      </button>

      <div className="alert alert-info" style={{ marginTop: ".9rem" }}>
        Demo: admin@demo.com / Admin@123
      </div>

      <div className="switch">
        New user? <button className="link" onClick={onSignup}>Register</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SCREEN 2 — REGISTRATION
// Fields: Photo · First Name · Last Name · Email Address · Phone Number · Country · Additional Information · Register button
// ─────────────────────────────────────────────────────────────────
function SignupScreen({ onLogin, onLoginSwitch }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", country: "", additionalInfo: "", role: "" });
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handlePhoto = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target.result);
    reader.readAsDataURL(f);
  };

  const handleRegister = () => {
    setError("");
    const errs = [
      V.required(form.firstName, "First name"),
      V.required(form.lastName, "Last name"),
      V.email(form.email),
      V.phone(form.phone),
      V.required(form.country, "Country"),
      V.required(form.role, "Role"),
    ].filter(Boolean);
    if (errs.length) { setError(errs[0]); return; }
    setLoading(true);
    setTimeout(() => {
      // Use a default password derived from email for account creation
      const tempPassword = "Default@123";
      const res = DB.create({ ...form, password: tempPassword, photo });
      if (res.error) { setError(res.error); setLoading(false); }
      else {
        const lr = DB.login(form.email, tempPassword);
        Session.save(lr.token);
        onLogin(lr.user);
      }
    }, 700);
  };

  return (
    <div className="card card-wide">
      <div className="screen-label">Registration Screen  (Screen 2)</div>
      {error && <Alert type="error">{error}</Alert>}

      <PhotoCircle preview={photo} onChange={handlePhoto} />

      {/* First Name + Last Name */}
      <div className="field-row">
        <div className="field"><input type="text" placeholder="First Name" value={form.firstName} onChange={set("firstName")} /></div>
        <div className="field"><input type="text" placeholder="Last Name" value={form.lastName} onChange={set("lastName")} /></div>
      </div>

      {/* Email Address */}
      <div className="field"><input type="email" placeholder="Email Address" value={form.email} onChange={set("email")} /></div>

      {/* Phone Number */}
      <div className="field"><input type="tel" placeholder="Phone Number" value={form.phone} onChange={set("phone")} /></div>

      {/* Country */}
      <div className="field"><input type="text" placeholder="Country" value={form.country} onChange={set("country")} /></div>

      {/* Additional Information */}
      <div className="field">
        <textarea placeholder="Additional Information ...." rows={3} value={form.additionalInfo} onChange={set("additionalInfo")} />
      </div>

      {/* Role */}
      <div className="field">
        <input type="text" placeholder="Role" value={form.role} onChange={set("role")} />
      </div>

      <button className="btn btn-register" disabled={loading} onClick={handleRegister}>
        {loading ? "Registering…" : "Register"}
      </button>

      <div className="switch">
        Have an account? <button className="link" onClick={onLoginSwitch}>Login</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// FORGOT PASSWORD
// ─────────────────────────────────────────────────────────────────
function ForgotScreen({ onBack }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const sendToken = () => {
    const ee = V.email(email); if (ee) { setError(ee); return; }
    setLoading(true);
    setTimeout(() => {
      const res = DB.generateResetToken(email);
      if (res.error) { setError(res.error); } else { setMsg(res.message); setError(""); setStep(2); }
      setLoading(false);
    }, 500);
  };

  const resetPwd = () => {
    const pe = V.password(newPwd); if (pe) { setError(pe); return; }
    if (!token.trim()) { setError("Enter the reset token"); return; }
    setLoading(true);
    setTimeout(() => {
      const res = DB.resetPassword(email, token, newPwd);
      if (res.error) { setError(res.error); setLoading(false); }
      else { setMsg("Password reset! Redirecting…"); setError(""); setTimeout(onBack, 1800); }
    }, 500);
  };

  return (
    <div className="card">
      <div className="screen-label">Forgot Password</div>
      {error && <Alert type="error">{error}</Alert>}
      {msg && <Alert type="success">{msg}</Alert>}

      {step === 1 ? (
        <>
          <div className="field"><input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <button className="btn btn-login" disabled={loading} onClick={sendToken}>{loading ? "Sending…" : "Send Reset Token"}</button>
        </>
      ) : (
        <>
          <div className="field"><input type="text" placeholder="Reset Token" value={token} onChange={e => setToken(e.target.value)} style={{ letterSpacing: "2px", textTransform: "uppercase" }} /></div>
          <div className="field"><input type="password" placeholder="New Password" value={newPwd} onChange={e => setNewPwd(e.target.value)} /></div>
          <button className="btn btn-login" disabled={loading} onClick={resetPwd}>{loading ? "Resetting…" : "Reset Password"}</button>
        </>
      )}
      <div className="switch"><button className="link" onClick={onBack}>← Back to login</button></div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// VENDORS PAGE
// ─────────────────────────────────────────────────────────────────
function VendorsPage() {
  const [search, setSearch]   = useState("");
  const [tab, setTab]         = useState("All");
  const [vendors, setVendors] = useState(DB.getVendors());
  const [stats, setStats] = useState(DB.getVendorStats());
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ name: "", category: "", gst: "", contact: "", status: "Active" });
  const [error, setError] = useState("");

  const refreshVendors = () => {
    setVendors(DB.getVendors());
    setStats(DB.getVendorStats());
  };

  const tabCounts = {
    All:     stats.total || 0,
    Active:  stats.active || 0,
    Pending: stats.pending || 0,
    Blocked: stats.blocked || 0,
  };

  const visible = vendors.filter(v => {
    const matchTab = tab === "All" || v.status === tab;
    const q = search.toLowerCase();
    const matchSearch = !q || v.name.toLowerCase().includes(q) || v.category.toLowerCase().includes(q) || v.gst.toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  const handleAdd = () => {
    setError("");
    if (!form.name.trim() || !form.category.trim() || !form.gst.trim()) {
      setError("Please complete vendor name, category, and GST number.");
      return;
    }
    const result = DB.addVendor(form);
    if (result.error) {
      setError(result.error);
      return;
    }
    refreshVendors();
    setForm({ name: "", category: "", gst: "", contact: "", status: "Active" });
    setShowAdd(false);
  };

  return (
    <>
      <div className="vp-header">
        <div>
          <div className="ml-page-title">Vendors</div>
          <div className="vp-sub">Manage supplier profiles and registrations</div>
        </div>
        <button className="vp-add-btn" onClick={() => setShowAdd(s => !s)}>+ Add Vendor</button>
      </div>

      {/* Inline add form */}
      {showAdd && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "1rem", marginBottom: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          {error && <div style={{ gridColumn: "span 3" }}><Alert type="error">{error}</Alert></div>}
          {[["Vendor Name","name"],["Category","category"],["GST No.","gst"],["Contact","contact"]].map(([ph, key]) => (
            <input key={key} className="vp-search" style={{ marginBottom: 0 }} placeholder={ph} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
          ))}
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: ".55rem .75rem", color: "var(--text)", fontSize: 12, outline: "none" }}>
            <option>Active</option><option>Pending</option><option>Blocked</option>
          </select>
          <div style={{ display: "flex", gap: "8px", gridColumn: "span 3" }}>
            <button className="vp-add-btn" onClick={handleAdd}>Save</button>
            <button className="vp-add-btn" style={{ borderColor: "var(--border)", color: "var(--muted)" }} onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      <input className="vp-search" placeholder="Search bar …  search by name, gst number, category…" value={search} onChange={e => setSearch(e.target.value)} />

      <div className="vp-tabs">
        {Object.entries(tabCounts).map(([label, count]) => (
          <button key={label} className={`vp-tab${tab === label ? " active" : ""}`} onClick={() => setTab(label)}>
            {label} ({count})
          </button>
        ))}
      </div>

      <div className="vp-table-wrap">
        <table className="vp-table">
          <thead>
            <tr>
              <th>Vendor Name</th><th>Category</th><th>GST no.</th><th>contact no.</th><th>Status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: "1.2rem" }}>No vendors found</td></tr>
            )}
            {visible.map(v => (
              <tr key={v.id}>
                <td>{v.name}</td>
                <td>{v.category}</td>
                <td style={{ fontFamily: "monospace", fontSize: 11 }}>{v.gst}</td>
                <td>{v.contact}</td>
                <td><span className={`vp-badge ${v.status.toLowerCase()}`}>{v.status}</span></td>
                <td><button className="vp-view-btn">View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// RFQ PAGE  (Create RFQ's)
// ─────────────────────────────────────────────────────────────────
const INIT_LINE_ITEMS = [
  { item: "Ergonomic chair", qty: 20, unit: "pcs" },
  { item: "Standing desks",  qty: 10, unit: "pcs" },
];

function RFQPage() {
  const [form, setForm] = useState({
    title: "Office Furniture procurement Q2",
    category: "Furniture",
    description: "Ergonomic chairs and Standing desks for 2nd floor",
  });
  const [lineItems, setLineItems] = useState(INIT_LINE_ITEMS);
  const [vendors, setVendors] = useState(DB.getVendors().map((v) => v.name));
  const [availableVendor, setAvailableVendor] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [message, setMessage] = useState("");

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || e.target.files || []);
    setAttachments((a) => [...a, ...files.map((f) => f.name)]);
  };

  const removeVendor = (name) => setVendors((current) => current.filter((x) => x !== name));
  const addVendor = () => {
    if (!availableVendor.trim()) return;
    setVendors((current) => Array.from(new Set([...current, availableVendor.trim()])));
    setAvailableVendor("");
  };

  const addLineItem = () => {
    setLineItems((items) => [...items, { item: "", qty: 1, unit: "pcs" }]);
  };

  const updateLineItem = (index, key, value) => {
    setLineItems((items) => items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const removeLineItem = (index) => {
    setLineItems((items) => items.filter((_, i) => i !== index));
  };

  const saveRFQ = (draft = false) => {
    const data = {
      title: form.title,
      category: form.category,
      description: form.description,
      vendors,
      attachments,
      lineItems,
      status: draft ? "Draft" : "Open",
    };

    const created = DB.createRFQ(data);
    if (created?.id) {
      setMessage(draft ? "RFQ saved as draft." : "RFQ created and ready for vendor responses.");
    } else {
      setMessage("Unable to create RFQ. Please check the form.");
    }
  };

  return (
    <>
      <div className="ml-page-title" style={{ marginBottom: ".25rem" }}>Create RFQ's</div>
      <div className="ml-page-sub">new request for quotation</div>

      {message && <Alert type="info">{message}</Alert>}

      <div className="rfq-wrap">
        <div className="rfq-col">
          <div className="rfq-col-title">RFQ Details</div>

          <div className="rfq-field">
            <label>RFQ's title *</label>
            <input value={form.title} onChange={setField("title")} placeholder="RFQ's title" />
          </div>

          <div className="rfq-field">
            <label>Category</label>
            <input value={form.category} onChange={setField("category")} placeholder="Category" />
          </div>

          <div className="rfq-field">
            <label>Description</label>
            <textarea rows={3} value={form.description} onChange={setField("description")} placeholder="Description…" />
          </div>

          <div className="rfq-field">
            <label>Vendors</label>
            {vendors.map((vendor) => (
              <div className="rfq-vendor-tag" key={vendor}>
                <span>{vendor}</span>
                <button onClick={() => removeVendor(vendor)}>×</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: "8px", marginTop: "0.75rem" }}>
              <input
                className="vp-search"
                style={{ marginBottom: 0, flex: 1 }}
                placeholder="Add vendor name"
                value={availableVendor}
                onChange={(e) => setAvailableVendor(e.target.value)}
              />
              <button className="rfq-add-vendor-btn" onClick={addVendor} style={{ alignSelf: "center" }}>
                Add
              </button>
            </div>
          </div>

          <div className="rfq-field">
            <label>Attachments</label>
            <div
              className="rfq-drop-zone"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById("rfq-file-input").click()}
            >
              {attachments.length > 0 ? attachments.join(", ") : "Drag & drop files or click to upload"}
            </div>
            <input id="rfq-file-input" type="file" multiple style={{ display: "none" }} onChange={handleDrop} />
          </div>

          <div className="rfq-btns">
            <button className="rfq-btn primary" onClick={() => saveRFQ(false)}>
              Save &amp; Send to Vendors
            </button>
            <button className="rfq-btn" onClick={() => saveRFQ(true)}>
              Save as Draft
            </button>
          </div>
        </div>

        <div className="rfq-col">
          <div className="rfq-col-title">Line Items</div>
          <table className="rfq-line-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li, index) => (
                <tr key={index}>
                  <td>
                    <input
                      className="vp-search"
                      style={{ marginBottom: 0, width: "100%" }}
                      value={li.item}
                      onChange={(e) => updateLineItem(index, "item", e.target.value)}
                      placeholder="Item description"
                    />
                  </td>
                  <td>
                    <input
                      className="vp-search"
                      style={{ marginBottom: 0, width: "100%" }}
                      type="number"
                      min="1"
                      value={li.qty}
                      onChange={(e) => updateLineItem(index, "qty", Number(e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      className="vp-search"
                      style={{ marginBottom: 0, width: "100%" }}
                      value={li.unit}
                      onChange={(e) => updateLineItem(index, "unit", e.target.value)}
                    />
                  </td>
                  <td>
                    <button
                      className="vp-view-btn"
                      style={{ padding: "0 8px" }}
                      onClick={() => removeLineItem(index)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="rfq-add-vendor-btn" style={{ fontSize: 11 }} onClick={addLineItem}>
            + add line item
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// SCREEN 3 — MAIN LANDING PAGE
// VendorBridge layout: topbar · sidebar · dashboard content
// ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = ["Dashboard", "Vendors", "RFQ's", "Quotations", "Approvals", "Purchase orders", "Invoices", "Reports", "Activity"];

const RECENT_POS = [
  { po: "Po1", vendor: "Infra",          amount: "87000",  status: "Approved" },
  { po: "Po2", vendor: "Tech core",      amount: "190000", status: "Pending"  },
  { po: "Po3", vendor: "OfficeNeed Co",  amount: "34900",  status: "draft"    },
];

function SpendingChart() {
  return (
    <svg viewBox="0 0 140 110" width="140" height="110" style={{ display: "block" }}>
      {/* pie */}
      <circle cx="100" cy="28" r="18" fill="#1e2028" stroke="rgba(255,255,255,.07)" strokeWidth="1"/>
      <path d="M100 10 A18 18 0 0 1 118 28 L100 28 Z" fill="#63b3ed"/>
      <path d="M118 28 A18 18 0 0 1 100 46 L100 28 Z" fill="#68d391"/>
      <path d="M100 46 A18 18 0 1 1 100 10 L100 28 Z" fill="#b794f4"/>
      {/* line chart */}
      <polyline points="10,85 30,70 50,78 70,58 90,65 110,50 130,55" fill="none" stroke="#fc8181" strokeWidth="2" strokeLinejoin="round"/>
      {[10,30,50,70,90,110,130].map((x,i)=>{
        const ys=[85,70,78,58,65,50,55];
        return <circle key={x} cx={x} cy={ys[i]} r="3" fill="#fc8181"/>;
      })}
      {/* bar chart */}
      {[
        {x:10,h:20,c:"#f6ad55"},{x:28,h:32,c:"#f6ad55"},{x:46,h:14,c:"#f6ad55"},
        {x:64,h:26,c:"#f6ad55"},{x:82,h:18,c:"#f6ad55"},
      ].map(b=>(
        <rect key={b.x} x={b.x} y={105-b.h} width="14" height={b.h} rx="2" fill={b.c} opacity=".7"/>
      ))}
    </svg>
  );
}

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const quotePrice = (quote) => asNumber(quote.price ?? quote.finalPrice ?? quote.totalPrice, 0);
const quoteRating = (quote) => asNumber(quote.rating ?? quote.vendorRating, 0);
const quoteVendor = (quote) => quote.vendorName || quote.name || "Unknown vendor";
const quoteGst = (quote) => asNumber(quote.gstPercent, 18);
const quoteDelivery = (quote) => Math.max(1, asNumber(quote.deliveryDays, 1));
const formatAmount = (amount) => `₹ ${asNumber(amount, 0).toLocaleString("en-IN")}`;

function QuotationsPage() {
  const [rfqs] = useState(DB.getRFQs());
  const [selectedRfqId, setSelectedRfqId] = useState(rfqs[0]?.id || null);
  const [viewMode, setViewMode] = useState("list");
  const [message, setMessage] = useState("");

  const selectedRfq = selectedRfqId ? DB.getRFQ(selectedRfqId) : null;
  const quotations = selectedRfq ? DB.getQuotations(selectedRfqId) : [];
  const bestQuotation = quotations.reduce((best, quote) => {
    if (!best || quotePrice(quote) < quotePrice(best)) return quote;
    return best;
  }, null);

  const handleInitiateApproval = (quotationId) => {
    const result = DB.createApproval(selectedRfqId, quotationId);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage("Approval workflow initiated for selected quotation.");
  };

  return (
    <div className="comp-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div className="ml-page-title">Quotations</div>
          <p className="comp-subtitle">Review vendor responses and choose the best quotation.</p>
        </div>
        <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
          <button
            className="comp-btn-select"
            style={viewMode === "list" ? { borderColor: "#68d391", color: "#68d391" } : undefined}
            onClick={() => setViewMode("list")}
          >
            Quotation list
          </button>
          <button
            className="comp-btn-select"
            style={viewMode === "compare" ? { borderColor: "#68d391", color: "#68d391" } : undefined}
            onClick={() => setViewMode("compare")}
          >
            Comparison
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <label style={{ color: "var(--muted)", fontSize: 12 }}>Select RFQ</label>
        <select
          value={selectedRfqId || ""}
          onChange={(e) => { setSelectedRfqId(e.target.value); setMessage(""); }}
          style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", padding: ".5rem .75rem" }}
        >
          {rfqs.map((rfq) => (
            <option key={rfq.id} value={rfq.id}>{rfq.title}</option>
          ))}
        </select>
      </div>

      {message && <Alert type="info">{message}</Alert>}

      {!selectedRfq && (
        <div style={{ padding: "1.2rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
          No RFQs available. Create one from the RFQ screen.
        </div>
      )}

      {selectedRfq && viewMode === "list" && (
        <>
          <div className="comp-table-wrapper">
            <table className="comp-matrix-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Price</th>
                  <th>GST %</th>
                  <th>Delivery</th>
                  <th>Rating</th>
                  <th>Payment</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {quotations.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: "1rem" }}>
                      No quotations received yet for this RFQ.
                    </td>
                  </tr>
                ) : quotations.map((quote) => (
                  <tr key={quote.id}>
                    <td>{quoteVendor(quote)}</td>
                    <td>{formatAmount(quotePrice(quote))}</td>
                    <td>{quoteGst(quote)}%</td>
                    <td>{quoteDelivery(quote)} days</td>
                    <td>{quoteRating(quote).toFixed(1)} / 5</td>
                    <td>{quote.paymentTerms || "30 days"}</td>
                    <td>
                      <button className="comp-btn-approve" onClick={() => handleInitiateApproval(quote.id)}>
                        Initiate approval
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selectedRfq && viewMode === "compare" && (
        <>
          <div className="comp-table-wrapper">
            <table className="comp-matrix-table">
              <thead>
                <tr>
                  <th>Criteria</th>
                  {quotations.map((quote) => (
                    <th key={quote.id} className={bestQuotation?.id === quote.id ? "comp-col-highlight" : ""}>
                      {quoteVendor(quote)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="criteria-label">Price</td>
                  {quotations.map((quote) => (
                    <td key={`${quote.id}-price`} className={bestQuotation?.id === quote.id ? "comp-col-highlight" : ""}>
                      {formatAmount(quotePrice(quote))}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="criteria-label">GST %</td>
                  {quotations.map((quote) => (
                    <td key={`${quote.id}-gst`} className={bestQuotation?.id === quote.id ? "comp-col-highlight" : ""}>
                      {quoteGst(quote)}%
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="criteria-label">Delivery (days)</td>
                  {quotations.map((quote) => (
                    <td key={`${quote.id}-delivery`} className={bestQuotation?.id === quote.id ? "comp-col-highlight" : ""}>
                      {quoteDelivery(quote)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="criteria-label">Vendor rating</td>
                  {quotations.map((quote) => (
                    <td key={`${quote.id}-rating`} className={bestQuotation?.id === quote.id ? "comp-col-highlight" : ""}>
                      {quoteRating(quote).toFixed(1)} / 5
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="criteria-label">Payment terms</td>
                  {quotations.map((quote) => (
                    <td key={`${quote.id}-payment`} className={bestQuotation?.id === quote.id ? "comp-col-highlight" : ""}>
                      {quote.paymentTerms || "30 days"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="criteria-label">Action</td>
                  {quotations.map((quote) => (
                    <td key={`${quote.id}-action`} className={bestQuotation?.id === quote.id ? "comp-col-highlight" : ""}>
                      <button className={bestQuotation?.id === quote.id ? "comp-btn-approve" : "comp-btn-select"} onClick={() => handleInitiateApproval(quote.id)}>
                        {bestQuotation?.id === quote.id ? "Approve" : "Select"}
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="comp-legend">
            Green indicates the currently lowest quotation by price.
          </div>
        </>
      )}
    </div>
  );
}

function PurchaseOrdersPage() {
  const [pos, setPos] = useState(DB.getPurchaseOrders());
  const [selectedPoId, setSelectedPoId] = useState(pos[0]?.id || null);
  const [message, setMessage] = useState("");

  const selectedPo = pos.find((order) => order.id === selectedPoId);
  const selectedPoInvoice = selectedPo ? DB.getInvoices().find((invoice) => invoice.poId === selectedPo.id) : null;

  const generateInvoice = () => {
    if (!selectedPo) return;
    const result = DB.createInvoice(selectedPo.id);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setPos(DB.getPurchaseOrders());
    setMessage(`Invoice ${result.invoice.invoiceNumber} generated for ${selectedPo.poNumber}.`);
  };

  return (
    <div className="comp-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div className="ml-page-title">Purchase Orders</div>
          <p className="comp-subtitle">Review all purchase orders and their current approval status.</p>
        </div>
      </div>

      {message && <Alert type="info">{message}</Alert>}

      <div className="comp-table-wrapper" style={{ marginBottom: "1rem" }}>
        <table className="comp-matrix-table">
          <thead>
            <tr>
              <th>PO #</th>
              <th>Vendor</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {pos.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "1rem", color: "var(--muted)" }}>
                  No purchase orders have been created yet.
                </td>
              </tr>
            ) : pos.map((order) => (
              <tr
                key={order.id}
                style={{ cursor: "pointer", background: order.id === selectedPoId ? "rgba(104,211,145,.08)" : undefined }}
                onClick={() => { setSelectedPoId(order.id); setMessage(""); }}
              >
                <td>{order.poNumber}</td>
                <td>{order.vendorName}</td>
                <td>{formatAmount(order.amount)}</td>
                <td>{order.status}</td>
                <td>{new Date(order.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedPo ? (
        <div className="comp-table-wrapper" style={{ padding: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <div className="ml-page-title" style={{ fontSize: 18, marginBottom: ".35rem" }}>PO Details</div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>Vendor: {selectedPo.vendorName}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "1rem" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "1rem" }}>
              <div style={{ marginBottom: ".6rem", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".8px" }}>PO Number</div>
              <div style={{ fontWeight: 600 }}>{selectedPo.poNumber}</div>
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "1rem" }}>
              <div style={{ marginBottom: ".6rem", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".8px" }}>Vendor</div>
              <div>{selectedPo.vendorName}</div>
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "1rem" }}>
              <div style={{ marginBottom: ".6rem", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".8px" }}>Amount</div>
              <div>{formatAmount(selectedPo.amount)}</div>
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "1rem" }}>
              <div style={{ marginBottom: ".6rem", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".8px" }}>Status</div>
              <div>{selectedPo.status}</div>
            </div>
          </div>
          <div style={{ marginTop: "1rem", display: "flex", gap: ".8rem", flexWrap: "wrap" }}>
            {selectedPoInvoice ? (
              <button className="comp-btn-select" onClick={() => setMessage(`Invoice ${selectedPoInvoice.invoiceNumber} already exists.`)}>
                View invoice
              </button>
            ) : (
              <button className="comp-btn-approve" onClick={generateInvoice}>Generate invoice</button>
            )}
            {selectedPo.status !== "Completed" && (
              <button
                className="comp-btn-select"
                onClick={() => {
                  DB.updatePOStatus(selectedPo.id, "Completed");
                  setPos(DB.getPurchaseOrders());
                  setMessage(`${selectedPo.poNumber} marked completed.`);
                }}
              >
                Mark completed
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InvoicesPage({ user }) {
  const [invoices, setInvoices] = useState(DB.getInvoices());
  const [pos, setPos] = useState(DB.getPurchaseOrders());
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(invoices[0]?.id || null);
  const [message, setMessage] = useState("");

  const refresh = () => {
    setInvoices(DB.getInvoices());
    setPos(DB.getPurchaseOrders());
  };

  const selectedInvoice = invoices.find((inv) => inv.id === selectedInvoiceId);
  const selectedPo = selectedInvoice ? pos.find((po) => po.id === selectedInvoice.poId) : null;
  const selectedRfq = selectedPo ? DB.getRFQ(selectedPo.rfqId) : null;

  const lineItems = selectedRfq ? selectedRfq.lineItems.map((item) => {
    const totalQty = selectedRfq.lineItems.reduce((sum, li) => sum + Number(li.qty || 0), 0) || 1;
    const unitPrice = selectedInvoice ? Math.round(selectedInvoice.amount / totalQty) : 0;
    return {
      item: item.item,
      qty: item.qty,
      unitPrice,
      total: item.qty * unitPrice,
    };
  }) : [];

  const total = lineItems.reduce((sum, item) => sum + item.total, 0);
  const gstAmount = selectedInvoice ? selectedInvoice.gstAmount : 0;
  const grandTotal = selectedInvoice ? selectedInvoice.total : 0;

  const markPaid = () => {
    if (!selectedInvoice) return;
    const result = DB.updateInvoicePayment(selectedInvoice.id, "Paid");
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage(`Invoice ${selectedInvoice.invoiceNumber} marked paid.`);
    refresh();
  };

  return (
    <div className="comp-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div className="ml-page-title">Purchase Order & Invoice</div>
          <p className="comp-subtitle">PO details and invoice preview for approved orders.</p>
        </div>
        <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
          <button className="comp-btn-select">Download PDF</button>
          <button className="comp-btn-select">Print</button>
          <button className="comp-btn-select">Email invoice</button>
        </div>
      </div>

      {message && <Alert type="info">{message}</Alert>}

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <select
          value={selectedInvoiceId || ""}
          onChange={(e) => { setSelectedInvoiceId(e.target.value); setMessage(""); }}
          style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", padding: ".6rem .85rem", minWidth: 240 }}
        >
          {invoices.map((inv) => (
            <option key={inv.id} value={inv.id}>{inv.invoiceNumber} • {inv.vendorName}</option>
          ))}
        </select>
      </div>

      {selectedInvoice && selectedPo && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <div style={{ minWidth: 240 }}>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: ".35rem" }}>Bill to</div>
              <div style={{ fontWeight: 600 }}>{user.firstName} {user.lastName}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: ".35rem" }}>Your Organization Name</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>123 business park, overhead</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>GSTIN: 22ABCDE1234F1Z5</div>
            </div>
            <div style={{ minWidth: 240 }}>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: ".35rem" }}>Vendor</div>
              <div style={{ fontWeight: 600 }}>{selectedInvoice.vendorName}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: ".35rem" }}>Invoice date: {new Date(selectedInvoice.createdAt).toLocaleDateString()}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Due date: {selectedInvoice.dueDate}</div>
            </div>
            <div style={{ minWidth: 240 }}>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: ".35rem" }}>PO Number</div>
              <div style={{ fontWeight: 600 }}>{selectedPo.poNumber}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: ".35rem" }}>Status: <strong>{selectedInvoice.paymentStatus}</strong></div>
            </div>
          </div>

          <div className="comp-table-wrapper" style={{ marginBottom: "1rem" }}>
            <table className="comp-matrix-table" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => (
                  <tr key={index}>
                    <td style={{ textAlign: "left" }}>{item.item}</td>
                    <td>{item.qty}</td>
                    <td>{formatAmount(item.unitPrice)}</td>
                    <td>{formatAmount(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: ".45rem" }}>Notes</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Payment due within 21 days of invoice date. Please quote invoice number on all payments.</div>
            </div>
            <div style={{ minWidth: 220, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: ".5rem", fontSize: 12, color: "var(--muted)" }}>
                <span>Subtotal</span>
                <span>{formatAmount(total)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: ".5rem", fontSize: 12, color: "var(--muted)" }}>
                <span>GST ({selectedInvoice.gstPercent}%)</span>
                <span>{formatAmount(gstAmount)}</span>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: ".7rem", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span>Total</span>
                <span>{formatAmount(grandTotal)}</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "1rem", display: "flex", gap: ".8rem", flexWrap: "wrap" }}>
            {selectedInvoice.paymentStatus !== "Paid" && (
              <button className="comp-btn-approve" onClick={markPaid}>Mark as Paid</button>
            )}
            <button className="comp-btn-select">Download PDF</button>
            <button className="comp-btn-select">Email invoice</button>
          </div>
        </div>
      )}

      {!selectedInvoice && (
        <div style={{ padding: "1.2rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
          No invoices are available yet. Generate one from a purchase order.
        </div>
      )}
    </div>
  );
}

function ActivityPage() {
  const [logs] = useState(DB.getActivity(100));
  const [query, setQuery] = useState("");

  const filteredLogs = logs.filter((entry) => {
    const search = query.trim().toLowerCase();
    if (!search) return true;
    return (
      entry.user.toLowerCase().includes(search) ||
      entry.action.toLowerCase().includes(search) ||
      entry.detail.toLowerCase().includes(search)
    );
  });

  return (
    <div className="comp-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div className="ml-page-title">Activity & Logs</div>
          <p className="comp-subtitle">Track system events, user actions, and approvals.</p>
        </div>
        <input
          className="vp-search"
          placeholder="Search activity…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 280 }}
        />
      </div>

      <div className="comp-table-wrapper">
        <table className="comp-matrix-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: "1rem", color: "var(--muted)" }}>
                  No activity matches the current filter.
                </td>
              </tr>
            ) : filteredLogs.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.timestamp).toLocaleString()}</td>
                <td>{item.user}</td>
                <td>{item.action}</td>
                <td>{item.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsPage() {
  const purchaseOrders = DB.getPurchaseOrders();
  const invoices = DB.getInvoices();
  const vendors = DB.getVendors();

  const totalSpend = purchaseOrders.reduce((sum, po) => sum + Number(po.amount || 0), 0);
  const totalOrders = purchaseOrders.length;
  const pendingApprovals = DB.getApprovals().filter((item) => item.status === "Pending").length;
  const totalInvoices = invoices.length;

  const spendByVendor = purchaseOrders.reduce((acc, po) => {
    acc[po.vendorName] = (acc[po.vendorName] || 0) + Number(po.amount || 0);
    return acc;
  }, {});

  const topVendors = Object.entries(spendByVendor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([vendor, amount]) => ({ vendor, amount }));

  const spendByCategory = vendors.reduce((acc, vendor) => {
    const total = purchaseOrders
      .filter((po) => po.vendorName === vendor.name)
      .reduce((sum, po) => sum + Number(po.amount || 0), 0);
    if (!total) return acc;
    acc[vendor.category] = (acc[vendor.category] || 0) + total;
    return acc;
  }, {});

  return (
    <div className="comp-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div className="ml-page-title">Reports & Analytics</div>
          <p className="comp-subtitle">Procurement performance, spend, and vendor insights.</p>
        </div>
      </div>

      <div className="ml-stats" style={{ marginBottom: "1.5rem" }}>
        {[
          { val: `₹ ${totalSpend.toLocaleString()}`, lbl: "Total Spend" },
          { val: `${totalOrders}`, lbl: "Purchase Orders" },
          { val: `${pendingApprovals}`, lbl: "Pending Approvals" },
          { val: `${totalInvoices}`, lbl: "Invoices" },
        ].map((stat) => (
          <div className="ml-stat" key={stat.lbl}>
            <div className="ml-stat-val">{stat.val}</div>
            <div className="ml-stat-lbl">{stat.lbl}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div className="ml-table-box">
          <div className="ml-table-title">Top Vendors by Spend</div>
          <table className="ml-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Spend</th>
              </tr>
            </thead>
            <tbody>
              {topVendors.length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ textAlign: "center", color: "var(--muted)", padding: "1rem" }}>
                    No purchase orders available.
                  </td>
                </tr>
              ) : topVendors.map((row) => (
                <tr key={row.vendor}>
                  <td>{row.vendor}</td>
                  <td>{formatAmount(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ml-table-box">
          <div className="ml-table-title">Spend by Category</div>
          <table className="ml-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Spend</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(spendByCategory).length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ textAlign: "center", color: "var(--muted)", padding: "1rem" }}>
                    No categorical spend available.
                  </td>
                </tr>
              ) : Object.entries(spendByCategory).map(([category, value]) => (
                <tr key={category}>
                  <td>{category}</td>
                  <td>₹ {value.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────
// APPROVALS PAGE  (Screen 8)
// Approval Workflow: 4-step stepper · approval chain · quotation summary · remarks · approve / reject
// ─────────────────────────────────────────────────────────────────
const APPROVAL_STEPS = [
  { label: "Submitted" },
  { label: "L1 Review" },
  { label: "L2 approval" },
  { label: "Generate PO" },
];

const APPROVAL_CHAIN = [
  {
    name: "Rahul Mehta",
    role: "Procurement head",
    status: "approved",
    icon: "✓",
    statusText: "Approved on May 20, 10:32 Am",
  },
  {
    name: "Priya Shah",
    role: "Finance manager",
    status: "awaiting",
    icon: "⏳",
    statusText: "Awaiting · Assigned May 21",
  },
];

const QUOTATION_SUMMARY = [
  { label: "Vendor",   value: "Infra Supplies T LTD" },
  { label: "Total",    value: "₹ 1,85,400" },
  { label: "Delivery", value: "10 days" },
  { label: "Rating",   value: "4.5 / 5" },
];

void APPROVAL_CHAIN;
void QUOTATION_SUMMARY;

function ApprovalsPage() {
  const [approvals, setApprovals] = useState(DB.getApprovals());
  const [selectedApprovalId, setSelectedApprovalId] = useState(approvals[0]?.id || null);
  const [remarks, setRemarks] = useState("");
  const [decision, setDecision] = useState(null); // "approved" | "rejected" | null
  const [message, setMessage] = useState("");
  // current step is 3 (L2 approval) — index 2 (0-based)
  const selectedApproval = approvals.find((approval) => approval.id === selectedApprovalId) || approvals[0] || null;
  const selectedRfq = selectedApproval ? DB.getRFQ(selectedApproval.rfqId) : null;
  const selectedQuote = selectedRfq && selectedApproval
    ? DB.getQuotations(selectedRfq.id).find((quote) => quote.id === selectedApproval.quotationId)
    : null;
  const existingPo = selectedApproval ? DB.getPurchaseOrders().find((po) => po.quotationId === selectedApproval.quotationId) : null;
  const currentStep = selectedApproval
    ? selectedApproval.status === "Pending"
      ? selectedApproval.currentStep || 2
      : selectedApproval.maxSteps || APPROVAL_STEPS.length
    : 1;
  const approvalChain = selectedApproval?.history?.length
    ? selectedApproval.history
    : [{ when: selectedApproval?.createdAt || new Date().toISOString(), action: "Submitted", remarks: "Approval initiated" }];

  const refreshApprovals = (activeId = selectedApprovalId) => {
    const nextApprovals = DB.getApprovals();
    setApprovals(nextApprovals);
    if (!nextApprovals.some((approval) => approval.id === activeId)) {
      setSelectedApprovalId(nextApprovals[0]?.id || null);
    }
  };

  const approveSelected = () => {
    if (!selectedApproval) return;
    const result = DB.approveApproval(selectedApproval.id, remarks);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    const poResult = DB.createPurchaseOrder(selectedApproval.quotationId);
    if (poResult.error) {
      setMessage(poResult.error);
      return;
    }
    setDecision("approved");
    setMessage(`Approval completed. ${poResult.purchaseOrder.poNumber} is ready.`);
    refreshApprovals(selectedApproval.id);
  };

  const rejectSelected = () => {
    if (!selectedApproval) return;
    const result = DB.rejectApproval(selectedApproval.id, remarks);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setDecision("rejected");
    setMessage("Approval rejected and saved.");
    refreshApprovals(selectedApproval.id);
  };

  if (!selectedApproval) {
    return (
      <div className="comp-container">
        <div>
          <div className="ml-page-title">Approval Workflow</div>
          <p className="comp-subtitle">No approvals have been initiated yet. Start one from Quotations.</p>
        </div>
      </div>
    );
  }

  if (decision) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "55%", gap: ".75rem" }}>
        <div style={{ fontSize: 44 }}>{decision === "approved" ? "✅" : "❌"}</div>
        <div className="ml-page-title" style={{ fontSize: 18 }}>
          {decision === "approved" ? "Approval Granted" : "Request Rejected"}
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          {message || (decision === "approved"
            ? "Workflow advanced to Generate PO stage."
            : "The quotation has been rejected.")}
        </div>
        {remarks && (
          <div style={{ marginTop: ".5rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: ".7rem 1rem", maxWidth: 380, fontSize: 12, color: "var(--muted)" }}>
            <strong style={{ color: "var(--text)" }}>Remarks:</strong> {remarks}
          </div>
        )}
        <button
          className="ap-btn-approve"
          style={{ marginTop: ".75rem", maxWidth: 180 }}
          onClick={() => { setDecision(null); setRemarks(""); refreshApprovals(selectedApproval.id); }}
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="ap-wrap">
      {/* Header */}
      <div>
        <div className="ml-page-title">Approval Workflow</div>
        <div className="ap-sub">
          RFQ: {selectedRfq?.title || "Unknown RFQ"} - Vendor: {selectedQuote ? quoteVendor(selectedQuote) : "Unknown vendor"} - {selectedQuote ? formatAmount(quotePrice(selectedQuote)) : "No quote"}
        </div>
      </div>

      {message && <Alert type="info">{message}</Alert>}

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <label style={{ color: "var(--muted)", fontSize: 12 }}>Select approval</label>
        <select
          value={selectedApproval.id}
          onChange={(e) => { setSelectedApprovalId(e.target.value); setDecision(null); setRemarks(""); setMessage(""); }}
          style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", padding: ".5rem .75rem" }}
        >
          {approvals.map((approval) => {
            const rfq = DB.getRFQ(approval.rfqId);
            const quote = rfq ? DB.getQuotations(rfq.id).find((item) => item.id === approval.quotationId) : null;
            return (
              <option key={approval.id} value={approval.id}>
                {rfq?.title || "Unknown RFQ"} - {quote ? quoteVendor(quote) : "Unknown vendor"} ({approval.status})
              </option>
            );
          })}
        </select>
      </div>

      {/* 4-step stepper */}
      <div className="ap-stepper">
        {APPROVAL_STEPS.map((step, i) => (
          <div key={step.label} style={{ display: "flex", alignItems: "center", flex: i < APPROVAL_STEPS.length - 1 ? "1 1 0" : "0 0 auto" }}>
            <div className="ap-step-node">
              <div className={`ap-step-circle${i < currentStep ? " done" : i === currentStep ? " current" : ""}`}>
                {i < currentStep ? "✓" : i + 1}
              </div>
              <div className={`ap-step-label${i === currentStep ? " current" : ""}`}>{step.label}</div>
            </div>
            {i < APPROVAL_STEPS.length - 1 && (
              <div className={`ap-step-connector${i < currentStep ? " done" : ""}`} />
            )}
          </div>
        ))}
      </div>

      {/* Two-column body */}
      <div className="ap-body">
        {/* LEFT — Approval chain + remarks */}
        <div className="ap-chain-box">
          <div className="ap-chain-title">Approval Chain</div>

          {approvalChain.map((event, index) => {
            const statusClass = selectedApproval.status === "Rejected" && index === approvalChain.length - 1
              ? "rejected"
              : selectedApproval.status === "Pending" && index === approvalChain.length - 1
                ? "awaiting"
                : "approved";
            return (
            <div className="ap-chain-item" key={`${event.action}-${event.when}-${index}`}>
              <div className={`ap-chain-icon ${statusClass}`}>
                <span style={{ fontSize: 15 }}>{statusClass === "approved" ? "✓" : statusClass === "rejected" ? "×" : "…"}</span>
              </div>
              <div>
                <div className="ap-chain-name">{event.action}</div>
                <div className="ap-chain-role">({new Date(event.when).toLocaleString()})</div>
                <div className={`ap-chain-status ${statusClass}`}>{event.remarks || selectedApproval.status}</div>
              </div>
            </div>
          );})}

          {/* Remarks */}
          <div className="ap-remarks">
            <div className="ap-remarks-label">Approval Remarks</div>
            <textarea
              className="ap-remarks-input"
              rows={4}
              placeholder="Add your comments or conditions…."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          {/* Approve / Reject buttons */}
          <div className="ap-action-row">
            <button className="ap-btn-approve" disabled={selectedApproval.status !== "Pending"} onClick={approveSelected}>
              {existingPo ? "Approved" : "Approve"}
            </button>
            <button className="ap-btn-reject" disabled={selectedApproval.status !== "Pending"} onClick={rejectSelected}>Reject</button>
          </div>
        </div>

        {/* RIGHT — Quotation summary */}
        <div className="ap-quote-box">
          <div className="ap-quote-title">Quotation Summary</div>
          {[
            { label: "Vendor", value: selectedQuote ? quoteVendor(selectedQuote) : "Unknown vendor" },
            { label: "Total", value: selectedQuote ? formatAmount(quotePrice(selectedQuote)) : "No quote" },
            { label: "Delivery", value: selectedQuote ? `${quoteDelivery(selectedQuote)} days` : "N/A" },
            { label: "Rating", value: selectedQuote ? `${quoteRating(selectedQuote).toFixed(1)} / 5` : "N/A" },
            { label: "Status", value: selectedApproval.status },
            { label: "PO", value: existingPo ? existingPo.poNumber : "Not generated" },
          ].map((row) => (
            <div className="ap-quote-row" key={row.label}>
              <span className="ap-quote-lbl">{row.label}:</span>
              <span className="ap-quote-val">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MainLanding({ user, onLogout }) {
  const [activeNav, setActiveNav] = useState("Dashboard");
  const initials = ((user.firstName || "")[0] + (user.lastName || "")[0]).toUpperCase();
  const displayName = `${user.firstName} ${user.lastName}`;
  const rfqs = DB.getRFQs();
  const approvals = DB.getApprovals();
  const purchaseOrders = DB.getPurchaseOrders();
  const invoices = DB.getInvoices();
  const recentOrders = purchaseOrders.slice(0, 5);
  const totalSpend = purchaseOrders.reduce((sum, po) => sum + asNumber(po.amount, 0), 0);

  const stats = [
    { val: `${rfqs.filter((rfq) => rfq.status !== "Draft").length}`, lbl: "Active RFQ's" },
    { val: `${approvals.filter((approval) => approval.status === "Pending").length}`, lbl: "Pending Approvals" },
    { val: formatAmount(totalSpend), lbl: "PO spend" },
    { val: `${invoices.filter((invoice) => invoice.paymentStatus !== "Paid").length}`, lbl: "unpaid invoices" },
  ];

  return (
    <div className="ml-wrap">
      {/* ── Top Bar ── */}
      <div className="ml-topbar">
        <span className="ml-brand">VendorBridge</span>
        <span className="ml-user-pill">{displayName}</span>
        <div className="ml-avatar-circle" title="Sign out" onClick={onLogout}>
          {user.photo ? <img src={user.photo} alt="avatar"/> : initials}
        </div>
      </div>

      <div className="ml-body">
        {/* ── Sidebar ── */}
        <nav className="ml-sidebar">
          {NAV_ITEMS.map(item => (
            <div
              key={item}
              className={`ml-nav-item${activeNav === item ? " active" : ""}`}
              onClick={() => setActiveNav(item)}
            >
              – {item}
            </div>
          ))}
        </nav>

        {/* ── Main Content ── */}
        <main className="ml-content">
          {activeNav === "Dashboard" && <>
            <div className="ml-page-title">Dashboard</div>
            <div className="ml-page-sub">Welcome back, {user.role || "Procurement Officer"} – Today's Overview</div>

            {/* Stat cards */}
            <div className="ml-stats">
              {stats.map(s => (
                <div className="ml-stat" key={s.lbl}>
                  <div className="ml-stat-val">{s.val}</div>
                  <div className="ml-stat-lbl">{s.lbl}</div>
                </div>
              ))}
            </div>

            {/* Table + Chart */}
            <div className="ml-bottom">
              <div className="ml-table-box">
                <div className="ml-table-title">Recent Purchase Orders</div>
                <table className="ml-table">
                  <thead>
                    <tr>
                      <th>PO#</th><th>Vendor</th><th>Amount</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ color: "var(--muted)", textAlign: "center", padding: ".8rem" }}>
                          No purchase orders yet.
                        </td>
                      </tr>
                    ) : recentOrders.map(r => (
                      <tr key={r.id}>
                        <td>{r.poNumber}</td>
                        <td>{r.vendorName}</td>
                        <td>{formatAmount(r.amount)}</td>
                        <td><span className={`ml-status ${r.status.toLowerCase()}`}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="ml-chart-box">
                <div className="ml-chart-title">Spending Trends last 6 months</div>
                <div className="ml-chart-img"><SpendingChart /></div>
              </div>
            </div>

            <hr className="ml-divider"/>

            {/* Action buttons */}
            <div className="ml-actions">
              <button className="ml-action-btn" onClick={() => setActiveNav("RFQ's")}>+ new RFQ</button>
              <button className="ml-action-btn" onClick={() => setActiveNav("Vendors")}>Add Vendor</button>
              <button className="ml-action-btn" onClick={() => setActiveNav("Invoices")}>View Invoices</button>
            </div>
          </>}

          {activeNav === "Vendors"    && <VendorsPage />}
          {activeNav === "RFQ's"      && <RFQPage />}
          {activeNav === "Quotations" && <QuotationsPage user={user} />}
          {activeNav === "Approvals"  && <ApprovalsPage />}
          {activeNav === "Purchase orders" && <PurchaseOrdersPage />}
          {activeNav === "Invoices" && <InvoicesPage user={user} />}
          {activeNav === "Activity"   && <ActivityPage />}
          {activeNav === "Reports"    && <ReportsPage />}

          {false && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60%", gap: ".5rem" }}>
              <div style={{ fontSize: 36 }}>🚧</div>
              <div className="ml-page-title" style={{ fontSize: 16 }}>{activeNav}</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Coming soon</div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────
export default function App() {
  const initialUser = Session.currentUser();
  const [screen, setScreen] = useState(initialUser ? "main" : "login");
  const [user, setUser] = useState(initialUser);

  const handleLogin = (u) => { setUser(u); setScreen("main"); };
  const handleLogout = () => { Session.clear(); setUser(null); setScreen("login"); };

  return (
    <>
      <style>{css}</style>
      {screen !== "main" && (
        <div className="app">
          {screen === "login"  && <LoginScreen  onLogin={handleLogin} onSignup={() => setScreen("signup")} onForgot={() => setScreen("forgot")} />}
          {screen === "signup" && <SignupScreen  onLogin={handleLogin} onLoginSwitch={() => setScreen("login")} />}
          {screen === "forgot" && <ForgotScreen  onBack={() => setScreen("login")} />}
        </div>
      )}
      {screen === "main" && user && <MainLanding user={user} onLogout={handleLogout} />}
    </>
  );
}
