/**
 * AuthApp.jsx — VendorBridge Procurement System
 * Screen 1: Login   Screen 2: Registration   Screen 3: Main Landing (Dashboard)
 * Screen 4: Vendors  Screen 5: Create RFQ
 */

import { useState, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
const uuid = () => crypto.randomUUID();
const now  = () => new Date().toISOString();
const fmt  = (iso) => new Date(iso).toLocaleDateString("en-IN",{ day:"numeric",month:"short",year:"numeric" });

// ─────────────────────────────────────────────────────────────────
// AUTH DB
// ─────────────────────────────────────────────────────────────────
const AuthDB = (() => {
  let users = JSON.parse(localStorage.getItem("vb_users") || "[]");
  let resets = {};
  const save = () => localStorage.setItem("vb_users", JSON.stringify(users));
  const hash = p => btoa(p + "_vb_salt");
  const chk  = (p,h) => hash(p) === h;
  const pub  = ({ password_hash, ...u }) => u;

  const api = {
    register({ firstName, lastName, email, phone, country, additionalInfo, role, password, photo }) {
      if (users.find(u => u.email === email.toLowerCase()))
        return { error: "Email already registered" };
      const u = { id:uuid(), firstName, lastName, email:email.toLowerCase(),
        phone, country, additionalInfo:additionalInfo||"", role:role||"",
        password_hash:hash(password), photo:photo||null, createdAt:now() };
      users.push(u); save();
      return { user: pub(u) };
    },
    login(email, password) {
      const u = users.find(u => u.email === email.toLowerCase());
      if (!u) return { error: "No account found" };
      if (!chk(password, u.password_hash)) return { error: "Incorrect password" };
      const token = btoa(JSON.stringify({ uid:u.id, exp:Date.now()+3_600_000 }));
      return { token, user: pub(u) };
    },
    fromToken(t) {
      try {
        const p = JSON.parse(atob(t));
        if (p.exp < Date.now()) return null;
        const u = users.find(u => u.id === p.uid);
        return u ? pub(u) : null;
      } catch { return null; }
    },
    requestReset(email) {
      const u = users.find(u => u.email === email.toLowerCase());
      if (!u) return { error: "No account found" };
      const tok = Math.random().toString(36).slice(2,10).toUpperCase();
      resets[email.toLowerCase()] = { tok, exp: Date.now()+600_000 };
      return { message: `Reset token: ${tok}  (valid 10 min)` };
    },
    doReset(email, tok, pwd) {
      const e = email.toLowerCase(), r = resets[e];
      if (!r || r.tok !== tok.toUpperCase() || r.exp < Date.now())
        return { error: "Invalid or expired token" };
      const u = users.find(u => u.email === e);
      if (!u) return { error: "User not found" };
      u.password_hash = hash(pwd);
      delete resets[e]; save();
      return { ok: true };
    },
    seed() {
      if (!users.length)
        this.register({ firstName:"Arjun", lastName:"Mehta", email:"admin@demo.com",
          phone:"9876543210", country:"India", additionalInfo:"Procurement Head",
          role:"Procurement Officer", password:"Admin@123" });
    },
  };
  return api;
})();
AuthDB.seed();

// ─────────────────────────────────────────────────────────────────
// VENDOR DB
// ─────────────────────────────────────────────────────────────────
const VendorDB = (() => {
  const KEY = "vb_vendors_v2";   // bumped version — forces re-seed
  let list = JSON.parse(localStorage.getItem(KEY) || "[]");
  const save = () => localStorage.setItem(KEY, JSON.stringify(list));

  const api = {
    all: () => list,
    add(v) { const r={id:uuid(),...v,createdAt:now()}; list.push(r); save(); return r; },
    seed() {
      if (list.length) return;
      [
        // Construction
        { name:"Infra Supplies Pvt Ltd",    category:"Construction",  gst:"22ABCDE1234F1Z5", contact:"9812345670", status:"Active"  },
        { name:"BuildRight Infra",          category:"Construction",  gst:"29UVWXY7890N5Z6", contact:"9856789014", status:"Blocked" },
        { name:"SteelMark Structures",      category:"Construction",  gst:"07SMSTR8823P3Z4", contact:"9867890125", status:"Active"  },
        { name:"ConcreteX Pvt Ltd",         category:"Construction",  gst:"21CNCRT4456Q6Z9", contact:"9878901236", status:"Pending" },
        // IT & Technology
        { name:"Tech Core LTD",             category:"IT",            gst:"27FGHIJ5678K2Z1", contact:"9823456781", status:"Active"  },
        { name:"Nexora Systems",            category:"IT",            gst:"19NEXSY9934R7Z2", contact:"9889012347", status:"Active"  },
        { name:"DataPath Solutions",        category:"IT",            gst:"24DTPTH2211S8Z3", contact:"9890123458", status:"Pending" },
        { name:"CloudNine Technologies",    category:"IT",            gst:"36CLNT5567T9Z5",  contact:"9801234569", status:"Active"  },
        // Logistics
        { name:"Fleeting Transport",        category:"Logistics",     gst:"06KLMNO9012L3Z8", contact:"9834567892", status:"Pending" },
        { name:"SwiftMove Logistics",       category:"Logistics",     gst:"08SWMV3345U1Z6",  contact:"9812309876", status:"Active"  },
        { name:"CargoLink India",           category:"Logistics",     gst:"11CRGLN6678V2Z7", contact:"9823410987", status:"Active"  },
        // Office & Supply
        { name:"OfficeNeed Co",             category:"Office Supply", gst:"33PQRST3456M4Z2", contact:"9845678903", status:"Active"  },
        { name:"StatPro Supplies",          category:"Office Supply", gst:"12STPRO1122W3Z8", contact:"9834521098", status:"Active"  },
        { name:"PaperWorld Pvt Ltd",        category:"Office Supply", gst:"09PWRLD7789X4Z9", contact:"9845632109", status:"Blocked" },
        // Finance & Consulting
        { name:"FinEdge Consulting",        category:"Finance",       gst:"16FNED4456Y5Z1",  contact:"9856743210", status:"Active"  },
        { name:"TaxBridge Advisors",        category:"Finance",       gst:"23TXBDG8823Z6Z2", contact:"9867854321", status:"Pending" },
        // Facility Management
        { name:"CleanSpace Services",       category:"Facility",      gst:"14CLNSP3312A7Z3", contact:"9878965432", status:"Active"  },
        { name:"SecureGuard Pvt Ltd",       category:"Facility",      gst:"18SCGRD5567B8Z4", contact:"9889076543", status:"Active"  },
        // Healthcare
        { name:"MedEquip Distributors",     category:"Healthcare",    gst:"10MDEQP9934C9Z5", contact:"9890187654", status:"Active"  },
        { name:"PharmaNet Supply Co",       category:"Healthcare",    gst:"25PHMNT2211D1Z6", contact:"9801298765", status:"Pending" },
      ].forEach(v => api.add(v));
    },
  };
  return api;
})();
VendorDB.seed();


// ─────────────────────────────────────────────────────────────────
// RFQ DB
// ─────────────────────────────────────────────────────────────────
const RFQDB = (() => {
  const KEY = "vb_rfqs_v2";   // bumped — forces re-seed
  let list = JSON.parse(localStorage.getItem(KEY) || "[]");
  const save = () => localStorage.setItem(KEY, JSON.stringify(list));

  const api = {
    all: () => list,
    add(r) { const rec={id:uuid(),...r,createdAt:now(),status:r.status||"Draft"}; list.push(rec); save(); return rec; },
    seed() {
      if (list.length) return;
      [
        { title:"Office Furniture Procurement Q2",   category:"Furniture",     status:"Sent",
          description:"Ergonomic chairs and standing desks for the 2nd floor refit",
          vendors:["Infra Supplies Pvt Ltd","OfficeNeed Co"],
          lineItems:[{item:"Ergonomic Chair",qty:20,unit:"pcs"},{item:"Standing Desk",qty:10,unit:"pcs"},{item:"Monitor Stand",qty:30,unit:"pcs"}],
          deadline:"2026-07-15" },
        { title:"IT Hardware Refresh 2026",          category:"IT",            status:"Draft",
          description:"Laptops, monitors and peripherals for engineering team expansion",
          vendors:["Tech Core LTD","Nexora Systems"],
          lineItems:[{item:"Laptop 16GB RAM",qty:15,unit:"pcs"},{item:"4K Monitor 27\"",qty:15,unit:"pcs"},{item:"Mechanical Keyboard",qty:15,unit:"pcs"},{item:"USB-C Hub",qty:15,unit:"pcs"}],
          deadline:"2026-07-30" },
        { title:"Logistics Partner Q3",              category:"Logistics",     status:"Closed",
          description:"Fleet vehicles for last-mile delivery operations in metro cities",
          vendors:["Fleeting Transport","SwiftMove Logistics"],
          lineItems:[{item:"Delivery Van",qty:5,unit:"nos"},{item:"Bike Courier",qty:20,unit:"nos"}],
          deadline:"2026-06-01" },
        { title:"Annual Facility Maintenance",       category:"Facility",      status:"Sent",
          description:"Housekeeping, security and HVAC maintenance contract renewal for FY26-27",
          vendors:["CleanSpace Services","SecureGuard Pvt Ltd"],
          lineItems:[{item:"Housekeeping Staff",qty:10,unit:"nos"},{item:"Security Guard",qty:8,unit:"nos"},{item:"HVAC Annual Service",qty:1,unit:"set"}],
          deadline:"2026-08-01" },
        { title:"Medical Supplies Restock",          category:"Healthcare",    status:"Draft",
          description:"First aid kits, PPE and basic medicines for all office locations",
          vendors:["MedEquip Distributors","PharmaNet Supply Co"],
          lineItems:[{item:"First Aid Kit",qty:25,unit:"pcs"},{item:"PPE Kit",qty:100,unit:"pcs"},{item:"Paracetamol Strip",qty:200,unit:"pcs"}],
          deadline:"2026-08-15" },
        { title:"Office Stationery & Consumables Q3",category:"Office Supply", status:"Sent",
          description:"Quarterly restock of printer paper, ink cartridges and general stationery",
          vendors:["StatPro Supplies","PaperWorld Pvt Ltd"],
          lineItems:[{item:"A4 Paper Ream",qty:500,unit:"pcs"},{item:"Ink Cartridge Black",qty:50,unit:"pcs"},{item:"Ballpoint Pens",qty:100,unit:"box"}],
          deadline:"2026-06-20" },
        { title:"Server Room Infrastructure",        category:"IT",            status:"Closed",
          description:"Rack servers, UPS units and network switches for the new data centre",
          vendors:["CloudNine Technologies","DataPath Solutions"],
          lineItems:[{item:"Rack Server 2U",qty:8,unit:"pcs"},{item:"UPS 10KVA",qty:4,unit:"pcs"},{item:"24-Port Switch",qty:6,unit:"pcs"}],
          deadline:"2026-05-30" },
        { title:"Construction Materials Phase 3",    category:"Construction",  status:"Draft",
          description:"Steel rods, cement and tiles for the new wing construction — phase 3",
          vendors:["SteelMark Structures","ConcreteX Pvt Ltd"],
          lineItems:[{item:"TMT Steel Rod 12mm",qty:500,unit:"kg"},{item:"Portland Cement",qty:200,unit:"box"},{item:"Floor Tiles",qty:1000,unit:"pcs"}],
          deadline:"2026-09-01" },
        { title:"Finance Audit Software Licenses",   category:"Finance",       status:"Sent",
          description:"Annual renewal of audit and compliance software for the finance department",
          vendors:["FinEdge Consulting","TaxBridge Advisors"],
          lineItems:[{item:"Audit Suite License",qty:10,unit:"nos"},{item:"Tax Filing Module",qty:5,unit:"nos"}],
          deadline:"2026-07-01" },
        { title:"Security Cameras & Access Control", category:"Facility",      status:"Draft",
          description:"IP cameras and biometric access control for all entry points",
          vendors:["SecureGuard Pvt Ltd"],
          lineItems:[{item:"IP Camera 4MP",qty:30,unit:"pcs"},{item:"Biometric Device",qty:8,unit:"pcs"},{item:"NVR 16-ch",qty:2,unit:"pcs"}],
          deadline:"2026-08-30" },
      ].forEach(r => api.add(r));
    },
  };
  return api;
})();
RFQDB.seed();

// ─────────────────────────────────────────────────────────────────
// PO DB  (for dashboard table)
// ─────────────────────────────────────────────────────────────────
const PURCHASE_ORDERS = [
  { po:"PO-001", vendor:"Infra Supplies Pvt Ltd",  amount:"₹87,000",   status:"Approved", date:"12 May 2026" },
  { po:"PO-002", vendor:"Tech Core LTD",           amount:"₹1,90,000", status:"Pending",  date:"18 May 2026" },
  { po:"PO-003", vendor:"OfficeNeed Co",            amount:"₹34,900",  status:"Draft",    date:"02 Jun 2026" },
  { po:"PO-004", vendor:"BuildRight Infra",         amount:"₹2,45,000",status:"Approved", date:"05 Jun 2026" },
  { po:"PO-005", vendor:"Fleeting Transport",       amount:"₹62,500",  status:"Pending",  date:"06 Jun 2026" },
  { po:"PO-006", vendor:"Nexora Systems",           amount:"₹1,12,000",status:"Approved", date:"08 Jun 2026" },
  { po:"PO-007", vendor:"CleanSpace Services",      amount:"₹28,400",  status:"Draft",    date:"09 Jun 2026" },
  { po:"PO-008", vendor:"StatPro Supplies",         amount:"₹15,750",  status:"Approved", date:"10 Jun 2026" },
  { po:"PO-009", vendor:"MedEquip Distributors",    amount:"₹44,200",  status:"Pending",  date:"11 Jun 2026" },
  { po:"PO-010", vendor:"SteelMark Structures",     amount:"₹3,80,000",status:"Approved", date:"12 Jun 2026" },
];

// ─────────────────────────────────────────────────────────────────
// SESSION
// ─────────────────────────────────────────────────────────────────
const Session = {
  save: t => localStorage.setItem("vb_token", t),
  get:  ()  => localStorage.getItem("vb_token"),
  clear:()  => localStorage.removeItem("vb_token"),
  user: ()  => { const t=Session.get(); return t ? AuthDB.fromToken(t) : null; },
};

// ─────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────
const V = {
  required: (v,l) => v.trim() ? "" : `${l} is required`,
  email:    v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "Enter a valid email",
  password: v => v.length < 8 ? "Min 8 characters" :
                 !/[A-Z]/.test(v) ? "Need at least 1 uppercase" :
                 !/[0-9]/.test(v) ? "Need at least 1 number" : "",
  phone:    v => /^\d{10}$/.test(v) ? "" : "10-digit phone required",
};

// ─────────────────────────────────────────────────────────────────
// GLOBAL CSS
// ─────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
  :root {
    --bg:#0e0f14; --surface:#161820; --surface2:#1e2028; --surface3:#252830;
    --border:rgba(255,255,255,0.08); --text:#eef0f6; --muted:#7a8396;
    --accent:#63b3ed; --green:#68d391; --red:#fc8181; --purple:#b794f4; --orange:#f6ad55;
  }
  html,body,#root { height:100%; }
  body { background:var(--bg); color:var(--text); font-family:'DM Sans',sans-serif; }

  /* ── AUTH SCREENS ── */
  .auth-wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:2rem 1rem; background:var(--bg); }
  .card  { background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:2rem; width:320px; }
  .card-wide { width:400px; }
  .card-title { font-family:'Syne',sans-serif; font-size:20px; font-weight:800; margin-bottom:.2rem; }
  .card-sub   { font-size:12px; color:var(--muted); margin-bottom:1.5rem; }

  .photo-ring { width:76px; height:76px; border-radius:50%; border:2px dashed var(--border); background:var(--surface2);
    display:flex; align-items:center; justify-content:center; margin:0 auto .4rem; cursor:pointer; overflow:hidden; transition:border-color .2s; }
  .photo-ring:hover { border-color:var(--accent); }
  .photo-ring img { width:100%; height:100%; object-fit:cover; }
  .photo-hint { font-size:11px; color:var(--muted); text-align:center; margin-bottom:1.2rem; }

  .field { margin-bottom:.85rem; }
  .field label { display:block; font-size:11px; color:var(--muted); margin-bottom:.3rem; font-weight:500; }
  .field input, .field textarea, .field select {
    width:100%; background:var(--surface2); border:1px solid var(--border);
    border-radius:8px; padding:.6rem .85rem; color:var(--text); font-size:13px;
    font-family:'DM Sans',sans-serif; outline:none; transition:border-color .2s; resize:none; }
  .field input:focus, .field textarea:focus, .field select:focus { border-color:rgba(99,179,237,.5); }
  .field input::placeholder, .field textarea::placeholder { color:var(--muted); }
  .field select option { background:var(--surface2); }
  .field-2col { display:grid; grid-template-columns:1fr 1fr; gap:10px; }

  .pwrap { position:relative; }
  .pwrap input { padding-right:2.4rem; }
  .eye { position:absolute; right:.7rem; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:var(--muted); font-size:14px; padding:0; line-height:1; }

  .btn { width:100%; padding:.7rem; border:none; border-radius:8px; font-family:'Syne',sans-serif; font-size:13px; font-weight:700; cursor:pointer; transition:opacity .15s,transform .1s; letter-spacing:.3px; margin-top:.4rem; }
  .btn:active { transform:scale(.98); }
  .btn:disabled { opacity:.45; cursor:not-allowed; }
  .btn-primary  { background:linear-gradient(135deg,#63b3ed,#b794f4); color:#0e0f14; }
  .btn-success  { background:linear-gradient(135deg,#68d391,#63b3ed); color:#0e0f14; }

  .toast { padding:.55rem .8rem; border-radius:7px; font-size:12px; margin-bottom:.85rem; display:flex; gap:6px; align-items:flex-start; }
  .toast-error   { background:rgba(252,129,129,.1); border:1px solid rgba(252,129,129,.2); color:var(--red); }
  .toast-success { background:rgba(104,211,145,.1); border:1px solid rgba(104,211,145,.2); color:var(--green); }
  .toast-info    { background:rgba(99,179,237,.1);  border:1px solid rgba(99,179,237,.15); color:var(--accent); }

  .link-btn { background:none; border:none; color:var(--accent); font-size:12px; cursor:pointer; padding:0; font-family:'DM Sans',sans-serif; text-decoration:underline; text-underline-offset:2px; }
  .auth-switch { text-align:center; font-size:12px; color:var(--muted); margin-top:1rem; }

  /* ── SHELL (Screen 3+) ── */
  .shell { display:flex; flex-direction:column; width:100vw; height:100vh; overflow:hidden; background:var(--bg); }

  .topbar { display:flex; align-items:center; justify-content:space-between; padding:.65rem 1.4rem;
    background:var(--surface); border-bottom:1px solid var(--border); flex-shrink:0; gap:1rem; }
  .topbar-brand { font-family:'Syne',sans-serif; font-size:16px; font-weight:800; color:var(--text); letter-spacing:-.3px; }
  .topbar-center { flex:1; }
  .topbar-pill { background:#5a32a3; border-radius:999px; padding:.3rem .9rem; font-size:12px; font-weight:600; color:#fff; white-space:nowrap; }
  .topbar-avatar { width:34px; height:34px; border-radius:50%; background:var(--surface2); border:2px solid var(--border);
    overflow:hidden; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; cursor:pointer; flex-shrink:0; transition:border-color .2s; }
  .topbar-avatar:hover { border-color:var(--accent); }
  .topbar-avatar img { width:100%; height:100%; object-fit:cover; }

  .shell-body { display:flex; flex:1; overflow:hidden; }

  .sidebar { width:210px; flex-shrink:0; background:var(--surface); border-right:1px solid var(--border);
    padding:1.2rem 0; display:flex; flex-direction:column; gap:2px; overflow-y:auto; }
  .nav-item { padding:.58rem 1.2rem; font-size:13px; color:var(--muted); cursor:pointer;
    border-radius:6px; margin:0 .6rem; transition:background .15s,color .15s; display:flex; align-items:center; gap:.5rem; }
  .nav-item:hover { background:var(--surface2); color:var(--text); }
  .nav-item.active { background:#172e1f; color:var(--green); font-weight:600; }
  .nav-icon { font-size:14px; width:18px; text-align:center; flex-shrink:0; }

  .page { flex:1; padding:1.6rem 2rem; overflow-y:auto; }
  .page-title { font-family:'Syne',sans-serif; font-size:22px; font-weight:800; margin-bottom:.2rem; }
  .page-sub   { font-size:13px; color:var(--muted); margin-bottom:1.4rem; }

  /* ── DASHBOARD ── */
  .stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:1rem; margin-bottom:1.6rem; }
  .stat-card { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:1.1rem 1.3rem; }
  .stat-val  { font-family:'Syne',sans-serif; font-size:26px; font-weight:800; }
  .stat-lbl  { font-size:11px; color:var(--muted); margin-top:5px; }

  .dash-bottom { display:grid; grid-template-columns:1fr 200px; gap:1.2rem; margin-bottom:1.4rem; }
  .panel { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:1rem 1.1rem; }
  .panel-title { font-size:12px; color:var(--muted); font-weight:600; margin-bottom:.8rem; text-transform:uppercase; letter-spacing:.6px; }

  .data-table { width:100%; border-collapse:collapse; font-size:12px; }
  .data-table th { text-align:left; color:var(--muted); padding:.35rem .6rem; border-bottom:1px solid var(--border); font-weight:500; }
  .data-table td { padding:.45rem .6rem; border-bottom:1px solid var(--border); }
  .data-table tr:last-child td { border-bottom:none; }
  .data-table tbody tr:hover td { background:rgba(255,255,255,.02); }

  .badge { display:inline-block; padding:2px 9px; border-radius:999px; font-size:11px; font-weight:500; }
  .badge-approved,.badge-active,.badge-sent { background:rgba(104,211,145,.15); color:var(--green); }
  .badge-pending  { background:rgba(99,179,237,.15); color:var(--accent); }
  .badge-draft    { background:rgba(122,131,150,.15); color:var(--muted); }
  .badge-blocked,.badge-closed { background:rgba(252,129,129,.15); color:var(--red); }

  .dash-divider { border:none; border-top:1px solid var(--border); margin:.4rem 0 1.1rem; }
  .action-row { display:flex; gap:.75rem; }
  .action-btn { padding:.5rem 1.1rem; border:1px solid var(--border); border-radius:8px; background:transparent;
    color:var(--text); font-size:12px; font-family:'DM Sans',sans-serif; cursor:pointer; transition:all .15s; }
  .action-btn:hover { border-color:var(--accent); background:rgba(99,179,237,.07); color:var(--accent); }

  /* Spending chart SVG */
  .chart-panel { display:flex; flex-direction:column; }

  /* ── VENDORS PAGE ── */
  .vp-topbar { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:1.2rem; gap:1rem; }
  .vp-search-bar { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:8px;
    padding:.6rem .9rem; color:var(--text); font-size:13px; font-family:'DM Sans',sans-serif; outline:none; margin-bottom:.9rem; }
  .vp-search-bar:focus { border-color:rgba(99,179,237,.5); }
  .vp-search-bar::placeholder { color:var(--muted); }
  .tab-row { display:flex; gap:.45rem; margin-bottom:.9rem; flex-wrap:wrap; }
  .tab-btn { padding:.3rem .85rem; border-radius:6px; font-size:12px; cursor:pointer; border:1px solid var(--border); background:transparent; color:var(--muted); transition:all .15s; }
  .tab-btn.active { background:#172e1f; color:var(--green); border-color:transparent; font-weight:600; }
  .tab-btn:hover:not(.active) { background:var(--surface2); color:var(--text); }
  .add-btn { padding:.45rem 1rem; border:1px solid var(--accent); border-radius:8px; background:transparent;
    color:var(--accent); font-size:12px; font-family:'DM Sans',sans-serif; cursor:pointer; white-space:nowrap; transition:background .15s; }
  .add-btn:hover { background:rgba(99,179,237,.1); }
  .icon-btn { padding:.3rem .7rem; border:1px solid var(--border); border-radius:6px; background:transparent;
    color:var(--text); font-size:11px; cursor:pointer; transition:all .15s; }
  .icon-btn:hover { border-color:var(--accent); color:var(--accent); }

  /* Add vendor slide-in form */
  .add-form { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:1rem 1.1rem; margin-bottom:1rem; }
  .add-form-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:.75rem; }
  .add-form-grid input, .add-form-grid select {
    background:var(--surface2); border:1px solid var(--border); border-radius:7px;
    padding:.5rem .75rem; color:var(--text); font-size:12px; font-family:'DM Sans',sans-serif; outline:none; }
  .add-form-grid input:focus, .add-form-grid select:focus { border-color:rgba(99,179,237,.5); }
  .add-form-grid input::placeholder { color:var(--muted); }
  .add-form-grid select option { background:var(--surface2); }

  /* ── RFQ PAGE ── */
  .rfq-layout { display:grid; grid-template-columns:1fr 1fr; gap:1.2rem; }
  .rfq-panel { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:1.2rem; }
  .rfq-panel-title { font-size:11px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.7px; margin-bottom:.9rem; }
  .step-bar { display:flex; align-items:center; gap:.5rem; margin-bottom:1.3rem; max-width:280px; }
  .step-circle { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center;
    font-size:11px; font-weight:700; border:2px solid var(--border); color:var(--muted); flex-shrink:0; }
  .step-circle.done    { background:var(--green); border-color:var(--green); color:#0e0f14; }
  .step-circle.current { border-color:var(--accent); color:var(--accent); }
  .step-line { flex:1; height:2px; background:var(--border); border-radius:2px; }
  .step-line.done { background:var(--green); }
  .rfq-field { margin-bottom:.8rem; }
  .rfq-field label { display:block; font-size:11px; color:var(--muted); margin-bottom:.3rem; }
  .rfq-field input, .rfq-field textarea, .rfq-field select {
    width:100%; background:var(--surface2); border:1px solid var(--border);
    border-radius:7px; padding:.5rem .75rem; color:var(--text); font-size:12px;
    font-family:'DM Sans',sans-serif; outline:none; transition:border-color .2s; resize:none; }
  .rfq-field input:focus,.rfq-field textarea:focus,.rfq-field select:focus { border-color:rgba(99,179,237,.5); }
  .rfq-field input::placeholder,.rfq-field textarea::placeholder { color:var(--muted); }
  .rfq-field select option { background:var(--surface2); }
  .vendor-tag { display:flex; align-items:center; justify-content:space-between; background:var(--surface2);
    border-radius:6px; padding:.3rem .65rem; font-size:12px; margin-bottom:.4rem; }
  .vendor-tag button { background:none; border:none; color:var(--muted); cursor:pointer; font-size:15px; line-height:1; padding:0; transition:color .15s; }
  .vendor-tag button:hover { color:var(--red); }
  .text-link { background:none; border:none; color:var(--accent); font-size:12px; cursor:pointer; padding:0; font-family:'DM Sans',sans-serif; text-decoration:underline; text-underline-offset:2px; }
  .drop-zone { border:1.5px dashed var(--border); border-radius:8px; padding:1.4rem; text-align:center; font-size:12px; color:var(--muted); cursor:pointer; transition:all .2s; }
  .drop-zone:hover { border-color:var(--accent); color:var(--accent); }
  .rfq-line-tbl { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:.6rem; }
  .rfq-line-tbl th { text-align:left; color:var(--muted); padding:.3rem .45rem; border-bottom:1px solid var(--border); font-weight:500; }
  .rfq-line-tbl td { padding:.35rem .45rem; border-bottom:1px solid var(--border); }
  .rfq-line-tbl tr:last-child td { border-bottom:none; }
  .rfq-line-tbl input { background:var(--surface2); border:1px solid var(--border); border-radius:5px;
    padding:.25rem .4rem; color:var(--text); font-size:12px; outline:none; width:100%; }
  .rfq-btns { display:flex; gap:.6rem; margin-top:.85rem; }
  .rfq-btn { flex:1; padding:.52rem; border:1px solid var(--border); border-radius:7px; background:transparent;
    color:var(--text); font-size:12px; font-family:'DM Sans',sans-serif; cursor:pointer; transition:all .15s; }
  .rfq-btn:hover:not(.rfq-btn-primary) { border-color:var(--accent); background:rgba(99,179,237,.07); }
  .rfq-btn-primary { background:linear-gradient(135deg,var(--green),var(--accent)); border-color:transparent; color:#0e0f14; font-weight:600; }
  .rfq-btn-primary:hover { opacity:.9; }

  /* coming soon */
  .coming-soon { display:flex; flex-direction:column; align-items:center; justify-content:center; height:60%; gap:.5rem; opacity:.6; }
`;

// ─────────────────────────────────────────────────────────────────
// SMALL UI ATOMS
// ─────────────────────────────────────────────────────────────────
function Toast({ type, children }) {
  return (
    <div className={`toast toast-${type}`}>
      <span>{type==="error"?"⚠":type==="success"?"✓":"ℹ"}</span>
      <span>{children}</span>
    </div>
  );
}

function PhotoRing({ preview, onChange }) {
  return (
    <label style={{display:"block"}}>
      <div className="photo-ring">
        {preview
          ? <img src={preview} alt="profile"/>
          : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{color:"var(--muted)"}}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        }
      </div>
      <div className="photo-hint">Upload Photo</div>
      <input type="file" accept="image/*" style={{display:"none"}} onChange={onChange}/>
    </label>
  );
}

function Badge({ status }) {
  const cls = `badge badge-${(status||"").toLowerCase().replace(/\s/g,"-")}`;
  return <span className={cls}>{status}</span>;
}

// ─────────────────────────────────────────────────────────────────
// SCREEN 1 — LOGIN
// ─────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, onSignup, onForgot }) {
  const [email,    setEmail]   = useState("");
  const [password, setPassword]= useState("");
  const [showPwd,  setShowPwd] = useState(false);
  const [photo,    setPhoto]   = useState(null);
  const [error,    setError]   = useState("");
  const [loading,  setLoading] = useState(false);

  const handlePhoto = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = ev => setPhoto(ev.target.result); r.readAsDataURL(f);
  };

  const submit = () => {
    setError("");
    if (!email.trim())    { setError("Email is required"); return; }
    if (!password)        { setError("Password is required"); return; }
    setLoading(true);
    setTimeout(() => {
      const res = AuthDB.login(email, password);
      if (res.error) { setError(res.error); setLoading(false); }
      else { Session.save(res.token); onLogin(res.user); }
    }, 500);
  };

  return (
    <div className="auth-wrap">
      <div className="card">
        <div className="card-title">Welcome back</div>
        <div className="card-sub">Sign in to VendorBridge</div>

        {error && <Toast type="error">{error}</Toast>}

        <PhotoRing preview={photo} onChange={handlePhoto}/>

        <div className="field">
          <label>Email / Username</label>
          <input type="email" placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </div>

        <div className="field">
          <label>Password</label>
          <div className="pwrap">
            <input type={showPwd?"text":"password"} placeholder="••••••••" value={password}
              onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/>
            <button type="button" className="eye" onClick={()=>setShowPwd(s=>!s)}>{showPwd?"🙈":"👁"}</button>
          </div>
        </div>

        <div style={{textAlign:"right",marginBottom:".3rem"}}>
          <button className="link-btn" onClick={onForgot}>Forgot password?</button>
        </div>

        <button className="btn btn-primary" disabled={loading} onClick={submit}>
          {loading ? "Signing in…" : "Login"}
        </button>

        <Toast type="info" style={{marginTop:".9rem"}}>Demo: admin@demo.com / Admin@123</Toast>

        <div className="auth-switch">
          New user? <button className="link-btn" onClick={onSignup}>Register here</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SCREEN 2 — REGISTRATION
// ─────────────────────────────────────────────────────────────────
function RegisterScreen({ onLogin, onLoginSwitch }) {
  const [form, setForm] = useState({
    firstName:"", lastName:"", email:"", phone:"",
    country:"", additionalInfo:"", role:"",
  });
  const [photo,   setPhoto]   = useState(null);
  const [showPwd, setShowPwd] = useState(false);
  const [pwd,     setPwd]     = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const set = k => e => setForm(f => ({...f, [k]:e.target.value}));

  const handlePhoto = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = ev => setPhoto(ev.target.result); r.readAsDataURL(f);
  };

  const submit = () => {
    setError("");
    const errs = [
      V.required(form.firstName,"First name"), V.required(form.lastName,"Last name"),
      V.email(form.email), V.phone(form.phone),
      V.required(form.country,"Country"), V.required(form.role,"Role"),
      V.password(pwd),
    ].filter(Boolean);
    if (errs.length) { setError(errs[0]); return; }
    setLoading(true);
    setTimeout(() => {
      const res = AuthDB.register({...form, password:pwd, photo});
      if (res.error) { setError(res.error); setLoading(false); }
      else {
        const lr = AuthDB.login(form.email, pwd);
        Session.save(lr.token);
        onLogin(lr.user);
      }
    }, 700);
  };

  return (
    <div className="auth-wrap">
      <div className="card card-wide">
        <div className="card-title">Create account</div>
        <div className="card-sub">Join VendorBridge — it's free</div>

        {error && <Toast type="error">{error}</Toast>}

        <PhotoRing preview={photo} onChange={handlePhoto}/>

        <div className="field-2col">
          <div className="field">
            <label>First Name *</label>
            <input placeholder="Arjun" value={form.firstName} onChange={set("firstName")}/>
          </div>
          <div className="field">
            <label>Last Name *</label>
            <input placeholder="Mehta" value={form.lastName} onChange={set("lastName")}/>
          </div>
        </div>

        <div className="field">
          <label>Email Address *</label>
          <input type="email" placeholder="you@company.com" value={form.email} onChange={set("email")}/>
        </div>

        <div className="field-2col">
          <div className="field">
            <label>Phone Number *</label>
            <input type="tel" placeholder="9876543210" value={form.phone} onChange={set("phone")}/>
          </div>
          <div className="field">
            <label>Country *</label>
            <input placeholder="India" value={form.country} onChange={set("country")}/>
          </div>
        </div>

        <div className="field">
          <label>Role *</label>
          <input placeholder="Procurement Officer" value={form.role} onChange={set("role")}/>
        </div>

        <div className="field">
          <label>Additional Information</label>
          <textarea rows={2} placeholder="Department, designation, notes…" value={form.additionalInfo} onChange={set("additionalInfo")}/>
        </div>

        <div className="field">
          <label>Password *</label>
          <div className="pwrap">
            <input type={showPwd?"text":"password"} placeholder="Min 8 chars, 1 upper, 1 number"
              value={pwd} onChange={e=>setPwd(e.target.value)}/>
            <button type="button" className="eye" onClick={()=>setShowPwd(s=>!s)}>{showPwd?"🙈":"👁"}</button>
          </div>
        </div>

        <button className="btn btn-success" disabled={loading} onClick={submit}>
          {loading ? "Creating account…" : "Register"}
        </button>

        <div className="auth-switch">
          Have an account? <button className="link-btn" onClick={onLoginSwitch}>Login</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// FORGOT PASSWORD
// ─────────────────────────────────────────────────────────────────
function ForgotScreen({ onBack }) {
  const [step,    setStep]    = useState(1);
  const [email,   setEmail]   = useState("");
  const [token,   setToken]   = useState("");
  const [newPwd,  setNewPwd]  = useState("");
  const [error,   setError]   = useState("");
  const [msg,     setMsg]     = useState("");
  const [loading, setLoading] = useState(false);

  const sendToken = () => {
    const e = V.email(email); if (e) { setError(e); return; }
    setLoading(true);
    setTimeout(() => {
      const res = AuthDB.requestReset(email);
      if (res.error) setError(res.error);
      else { setMsg(res.message); setError(""); setStep(2); }
      setLoading(false);
    }, 500);
  };

  const doReset = () => {
    const e = V.password(newPwd); if (e) { setError(e); return; }
    if (!token.trim()) { setError("Enter the reset token"); return; }
    setLoading(true);
    setTimeout(() => {
      const res = AuthDB.doReset(email, token, newPwd);
      if (res.error) { setError(res.error); setLoading(false); }
      else { setMsg("Password reset! Redirecting…"); setError(""); setTimeout(onBack, 1800); }
    }, 500);
  };

  return (
    <div className="auth-wrap">
      <div className="card">
        <div className="card-title">Reset password</div>
        <div className="card-sub">We'll send you a one-time token</div>
        {error && <Toast type="error">{error}</Toast>}
        {msg   && <Toast type="success">{msg}</Toast>}

        {step === 1 ? <>
          <div className="field">
            <label>Email Address</label>
            <input type="email" placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)}/>
          </div>
          <button className="btn btn-primary" disabled={loading} onClick={sendToken}>{loading?"Sending…":"Send Reset Token"}</button>
        </> : <>
          <div className="field">
            <label>Reset Token</label>
            <input placeholder="XXXXXXXX" value={token} onChange={e=>setToken(e.target.value)} style={{letterSpacing:"2px",textTransform:"uppercase"}}/>
          </div>
          <div className="field">
            <label>New Password</label>
            <input type="password" placeholder="••••••••" value={newPwd} onChange={e=>setNewPwd(e.target.value)}/>
          </div>
          <button className="btn btn-primary" disabled={loading} onClick={doReset}>{loading?"Resetting…":"Reset Password"}</button>
        </>}

        <div className="auth-switch"><button className="link-btn" onClick={onBack}>← Back to login</button></div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SPENDING CHART (SVG)
// ─────────────────────────────────────────────────────────────────
function SpendingChart() {
  const months = ["Jan","Feb","Mar","Apr","May","Jun"];
  const vals   = [62, 95, 78, 110, 88, 130];
  const max    = Math.max(...vals);
  const W=160, H=90, pad=10;
  const x = i => pad + i * (W - 2*pad) / (vals.length-1);
  const y = v => H - pad - (v/max)*(H - 2*pad);
  const pts = vals.map((v,i) => `${x(i)},${y(v)}`).join(" ");

  return (
    <div className="chart-panel">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{display:"block"}}>
        {/* grid lines */}
        {[0,.25,.5,.75,1].map(t=>(
          <line key={t} x1={pad} y1={pad+(1-t)*(H-2*pad)} x2={W-pad} y2={pad+(1-t)*(H-2*pad)}
            stroke="rgba(255,255,255,.05)" strokeWidth="1"/>
        ))}
        {/* area fill */}
        <polygon
          points={`${x(0)},${H-pad} ${pts} ${x(vals.length-1)},${H-pad}`}
          fill="rgba(99,179,237,.12)"/>
        {/* line */}
        <polyline points={pts} fill="none" stroke="#63b3ed" strokeWidth="2" strokeLinejoin="round"/>
        {/* dots */}
        {vals.map((v,i)=>(
          <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="#63b3ed" stroke="var(--surface)" strokeWidth="1.5"/>
        ))}
      </svg>
      {/* month labels */}
      <div style={{display:"flex",justifyContent:"space-between",padding:"0 2px",marginTop:"2px"}}>
        {months.map(m=><span key={m} style={{fontSize:9,color:"var(--muted)"}}>{m}</span>)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// DASHBOARD PAGE
// ─────────────────────────────────────────────────────────────────
function DashboardPage({ user, onNavigate }) {
  const stats = [
    { val:"12", lbl:"Active RFQ's",       color:"var(--accent)"  },
    { val:"5",  lbl:"Pending Approvals",  color:"var(--orange)"  },
    { val:"₹2.3L", lbl:"POs this month", color:"var(--green)"   },
    { val:"3",  lbl:"Overdue Invoices",   color:"var(--red)"     },
  ];

  return (
    <>
      <div className="page-title">Dashboard</div>
      <div className="page-sub">Welcome back, {user.role || "Procurement Officer"} – Today's Overview</div>

      <div className="stat-grid">
        {stats.map(s => (
          <div className="stat-card" key={s.lbl}>
            <div className="stat-val" style={{color:s.color}}>{s.val}</div>
            <div className="stat-lbl">{s.lbl}</div>
          </div>
        ))}
      </div>

      <div className="dash-bottom">
        <div className="panel">
          <div className="panel-title">Recent Purchase Orders</div>
          <table className="data-table">
            <thead>
              <tr><th>PO #</th><th>Vendor</th><th>Amount</th><th>Date</th><th>Status</th></tr>
            </thead>
            <tbody>
              {PURCHASE_ORDERS.map(r => (
                <tr key={r.po}>
                  <td style={{fontWeight:600}}>{r.po}</td>
                  <td>{r.vendor}</td>
                  <td style={{fontFamily:"monospace"}}>{r.amount}</td>
                  <td style={{color:"var(--muted)"}}>{r.date}</td>
                  <td><Badge status={r.status}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel-title">Spending Trends · 6 mo</div>
          <SpendingChart/>
          <div style={{marginTop:".7rem",fontSize:11,color:"var(--muted)"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span>● IT</span><span style={{color:"var(--text)"}}>₹1.9L</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span>● Construction</span><span style={{color:"var(--text)"}}>₹3.3L</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span>● Logistics</span><span style={{color:"var(--text)"}}>₹62K</span>
            </div>
          </div>
        </div>
      </div>

      <hr className="dash-divider"/>

      <div className="action-row">
        <button className="action-btn" onClick={()=>onNavigate("RFQ's")}>+ New RFQ</button>
        <button className="action-btn" onClick={()=>onNavigate("Vendors")}>Add Vendor</button>
        <button className="action-btn" onClick={()=>onNavigate("Invoices")}>View Invoices</button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// VENDORS PAGE
// ─────────────────────────────────────────────────────────────────
function VendorsPage() {
  const [search,  setSearch]  = useState("");
  const [tab,     setTab]     = useState("All");
  const [vendors, setVendors] = useState(VendorDB.all());
  const [showAdd, setShowAdd] = useState(false);
  const [form,    setForm]    = useState({ name:"", category:"", gst:"", contact:"", status:"Active" });
  const [viewV,   setViewV]   = useState(null);

  const refresh = () => setVendors([...VendorDB.all()]);

  const counts = { All:vendors.length,
    Active:vendors.filter(v=>v.status==="Active").length,
    Pending:vendors.filter(v=>v.status==="Pending").length,
    Blocked:vendors.filter(v=>v.status==="Blocked").length };

  const visible = vendors.filter(v => {
    const matchTab = tab === "All" || v.status === tab;
    const q = search.toLowerCase();
    return matchTab && (!q || v.name.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) || v.gst.toLowerCase().includes(q) ||
      v.contact.includes(q));
  });

  const handleAdd = () => {
    if (!form.name.trim() || !form.category.trim()) return;
    VendorDB.add(form);
    refresh();
    setForm({ name:"", category:"", gst:"", contact:"", status:"Active" });
    setShowAdd(false);
  };

  if (viewV) {
    return (
      <>
        <div style={{display:"flex",alignItems:"center",gap:".7rem",marginBottom:"1.2rem"}}>
          <button className="icon-btn" onClick={()=>setViewV(null)}>← Back</button>
          <div className="page-title" style={{marginBottom:0}}>{viewV.name}</div>
          <Badge status={viewV.status}/>
        </div>
        <div className="panel" style={{maxWidth:520}}>
          {[["Category",viewV.category],["GST No.",viewV.gst],["Contact",viewV.contact],
            ["Status",viewV.status],["Registered",fmt(viewV.createdAt)]].map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:".55rem 0",
              borderBottom:"1px solid var(--border)",fontSize:13}}>
              <span style={{color:"var(--muted)"}}>{l}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="vp-topbar">
        <div>
          <div className="page-title">Vendors</div>
          <div className="page-sub" style={{marginBottom:0}}>Manage supplier profiles and registrations</div>
        </div>
        <button className="add-btn" onClick={()=>setShowAdd(s=>!s)}>+ Add Vendor</button>
      </div>

      {showAdd && (
        <div className="add-form">
          <div style={{fontSize:12,fontWeight:600,color:"var(--muted)",marginBottom:".6rem",textTransform:"uppercase",letterSpacing:".6px"}}>New Vendor</div>
          <div className="add-form-grid">
            {[["Vendor Name","name"],["Category","category"],["GST No.","gst"],["Contact No.","contact"]].map(([ph,k])=>(
              <input key={k} placeholder={ph} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/>
            ))}
            <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
              <option>Active</option><option>Pending</option><option>Blocked</option>
            </select>
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button className="add-btn" onClick={handleAdd}>Save Vendor</button>
            <button className="add-btn" style={{borderColor:"var(--border)",color:"var(--muted)"}} onClick={()=>setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      <input className="vp-search-bar"
        placeholder="Search by name, GST number, category, contact…"
        value={search} onChange={e=>setSearch(e.target.value)}/>

      <div className="tab-row">
        {Object.entries(counts).map(([label,count])=>(
          <button key={label} className={`tab-btn${tab===label?" active":""}`} onClick={()=>setTab(label)}>
            {label} <span style={{opacity:.7}}>({count})</span>
          </button>
        ))}
      </div>

      <div className="panel" style={{padding:0}}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{padding:".55rem .9rem"}}>Vendor Name</th>
              <th>Category</th>
              <th>GST No.</th>
              <th>Contact No.</th>
              <th>Registered</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={7} style={{textAlign:"center",color:"var(--muted)",padding:"1.5rem"}}>No vendors found</td></tr>
            )}
            {visible.map(v => (
              <tr key={v.id}>
                <td style={{padding:".55rem .9rem",fontWeight:600}}>{v.name}</td>
                <td>{v.category}</td>
                <td style={{fontFamily:"monospace",fontSize:11}}>{v.gst}</td>
                <td>{v.contact}</td>
                <td style={{color:"var(--muted)"}}>{fmt(v.createdAt)}</td>
                <td><Badge status={v.status}/></td>
                <td><button className="icon-btn" onClick={()=>setViewV(v)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// RFQ PAGE
// ─────────────────────────────────────────────────────────────────
function RFQPage() {
  const [view,    setView]    = useState("list"); // "list" | "create"
  const [rfqs,    setRfqs]    = useState(RFQDB.all());
  const [step,    setStep]    = useState(1);
  const [form,    setForm]    = useState({ title:"", category:"", description:"", deadline:"" });
  const [vendors, setVendors] = useState([]);
  const [vendorInput, setVendorInput] = useState("");
  const [lineItems, setLineItems] = useState([{item:"",qty:"",unit:"pcs"}]);
  const [attachments, setAttachments] = useState([]);
  const [saved,   setSaved]   = useState("");

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const addVendor = () => {
    const v = vendorInput.trim(); if (!v || vendors.includes(v)) return;
    setVendors(a=>[...a,v]); setVendorInput("");
  };
  const removeVendor = v => setVendors(a=>a.filter(x=>x!==v));
  const setLine = (i,k,val) => setLineItems(a=>a.map((r,j)=>j===i?{...r,[k]:val}:r));
  const addLine = () => setLineItems(a=>[...a,{item:"",qty:"",unit:"pcs"}]);
  const removeLine = i => setLineItems(a=>a.filter((_,j)=>j!==i));

  const handleDrop = e => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files||e.target.files||[]);
    setAttachments(a=>[...a,...files.map(f=>f.name)]);
  };

  const handleSave = (asDraft) => {
    if (!form.title.trim()) { setSaved("error:Title is required"); return; }
    RFQDB.add({...form, vendors, lineItems, status: asDraft?"Draft":"Sent"});
    setRfqs([...RFQDB.all()]);
    setSaved(asDraft?"Saved as Draft!":"Sent to Vendors!");
    setTimeout(()=>{ setSaved(""); setView("list"); resetForm(); }, 1500);
  };

  const resetForm = () => {
    setForm({title:"",category:"",description:"",deadline:""});
    setVendors([]); setLineItems([{item:"",qty:"",unit:"pcs"}]);
    setAttachments([]); setStep(1); setVendorInput("");
  };

  if (view === "list") {
    return (
      <>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"1.2rem"}}>
          <div>
            <div className="page-title">RFQ's</div>
            <div className="page-sub" style={{marginBottom:0}}>Request for Quotation — all records</div>
          </div>
          <button className="add-btn" onClick={()=>{resetForm();setView("create");}}>+ New RFQ</button>
        </div>

        <div className="panel" style={{padding:0}}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{padding:".55rem .9rem"}}>Title</th>
                <th>Category</th>
                <th>Vendors</th>
                <th>Deadline</th>
                <th>Created</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rfqs.map(r=>(
                <tr key={r.id}>
                  <td style={{padding:".55rem .9rem",fontWeight:600}}>{r.title}</td>
                  <td>{r.category}</td>
                  <td style={{color:"var(--muted)",fontSize:11}}>{(r.vendors||[]).join(", ")||"—"}</td>
                  <td style={{color:"var(--muted)"}}>{r.deadline||"—"}</td>
                  <td style={{color:"var(--muted)"}}>{fmt(r.createdAt)}</td>
                  <td><Badge status={r.status}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  // CREATE VIEW
  return (
    <>
      <div style={{display:"flex",alignItems:"center",gap:".7rem",marginBottom:".3rem"}}>
        <button className="icon-btn" onClick={()=>setView("list")}>← Back</button>
        <div className="page-title" style={{marginBottom:0}}>Create RFQ</div>
      </div>
      <div className="page-sub">new request for quotation</div>

      {saved && <Toast type={saved.startsWith("error:")?"error":"success"}>{saved.replace("error:","")}</Toast>}

      {/* Step bar */}
      <div className="step-bar">
        <div className={`step-circle${step>=1?" done":""}`}>1</div>
        <div className={`step-line${step>=2?" done":""}`}/>
        <div className={`step-circle${step>=2?" done":step===2?" current":""}`}>2</div>
        <div className={`step-line${step>=3?" done":""}`}/>
        <div className={`step-circle${step>=3?" done":step===3?" current":""}`}>3</div>
      </div>

      <div className="rfq-layout">
        {/* LEFT — RFQ details + vendors + attachments */}
        <div className="rfq-panel">
          <div className="rfq-panel-title">RFQ Details</div>

          <div className="rfq-field">
            <label>RFQ Title *</label>
            <input placeholder="Office Furniture procurement Q2" value={form.title} onChange={set("title")}/>
          </div>

          <div className="rfq-field">
            <label>Category</label>
            <select value={form.category} onChange={set("category")}>
              <option value="">Select category…</option>
              {["IT","Furniture","Logistics","Construction","Office Supply","Other"].map(c=>(
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="rfq-field">
            <label>Deadline</label>
            <input type="date" value={form.deadline} onChange={set("deadline")}
              style={{colorScheme:"dark"}}/>
          </div>

          <div className="rfq-field">
            <label>Description</label>
            <textarea rows={3} placeholder="Describe your requirements…" value={form.description} onChange={set("description")}/>
          </div>

          {/* Vendors */}
          <div className="rfq-field">
            <label>Invite Vendors</label>
            {vendors.map(v=>(
              <div className="vendor-tag" key={v}>
                <span>{v}</span>
                <button onClick={()=>removeVendor(v)}>×</button>
              </div>
            ))}
            <div style={{display:"flex",gap:"6px",marginTop:".3rem"}}>
              <input style={{flex:1,background:"var(--surface2)",border:"1px solid var(--border)",
                borderRadius:7,padding:".4rem .65rem",color:"var(--text)",fontSize:12,outline:"none"}}
                placeholder="Type vendor name…" value={vendorInput}
                onChange={e=>setVendorInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&addVendor()}/>
              <button className="icon-btn" onClick={addVendor}>+ add</button>
            </div>
          </div>

          {/* Attachments */}
          <div className="rfq-field">
            <label>Attachments</label>
            <div className="drop-zone" onDrop={handleDrop} onDragOver={e=>e.preventDefault()}
              onClick={()=>document.getElementById("rfq-file").click()}>
              {attachments.length
                ? attachments.map((f,i)=><div key={i} style={{fontSize:11}}>{f}</div>)
                : "Drag & drop files or click to upload"}
            </div>
            <input id="rfq-file" type="file" multiple style={{display:"none"}} onChange={handleDrop}/>
          </div>

          <div className="rfq-btns">
            <button className={`rfq-btn rfq-btn-primary`} onClick={()=>handleSave(false)}>Save &amp; Send to Vendors</button>
            <button className="rfq-btn" onClick={()=>handleSave(true)}>Save as Draft</button>
          </div>
        </div>

        {/* RIGHT — Line items */}
        <div className="rfq-panel">
          <div className="rfq-panel-title">Line Items</div>

          <table className="rfq-line-tbl">
            <thead>
              <tr><th style={{width:"50%"}}>Item</th><th>Qty</th><th>Unit</th><th></th></tr>
            </thead>
            <tbody>
              {lineItems.map((li,i)=>(
                <tr key={i}>
                  <td><input placeholder="Item description" value={li.item} onChange={e=>setLine(i,"item",e.target.value)}/></td>
                  <td><input type="number" placeholder="0" value={li.qty} onChange={e=>setLine(i,"qty",e.target.value)} style={{width:60}}/></td>
                  <td>
                    <select value={li.unit} onChange={e=>setLine(i,"unit",e.target.value)}
                      style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:5,
                        padding:".25rem .3rem",color:"var(--text)",fontSize:11,outline:"none"}}>
                      {["pcs","nos","kg","ltr","box","set"].map(u=><option key={u}>{u}</option>)}
                    </select>
                  </td>
                  <td>
                    {lineItems.length > 1 &&
                      <button onClick={()=>removeLine(i)} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:14}}>×</button>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="text-link" style={{fontSize:11}} onClick={addLine}>+ add line item</button>

          {/* Summary card */}
          <div style={{marginTop:"1.2rem",background:"var(--surface2)",borderRadius:8,padding:".85rem",fontSize:12}}>
            <div style={{fontWeight:600,marginBottom:".5rem",color:"var(--muted)",fontSize:11,textTransform:"uppercase",letterSpacing:".6px"}}>Summary</div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{color:"var(--muted)"}}>Title</span>
              <span style={{maxWidth:"60%",textAlign:"right",wordBreak:"break-all"}}>{form.title||"—"}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{color:"var(--muted)"}}>Category</span><span>{form.category||"—"}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{color:"var(--muted)"}}>Deadline</span><span>{form.deadline||"—"}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{color:"var(--muted)"}}>Vendors</span><span>{vendors.length}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{color:"var(--muted)"}}>Line Items</span><span>{lineItems.filter(l=>l.item).length}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// SHELL — wraps all post-login pages
// ─────────────────────────────────────────────────────────────────
const NAV = [
  { key:"Dashboard",       icon:"⊞" },
  { key:"Vendors",         icon:"🏢" },
  { key:"RFQ's",           icon:"📋" },
  { key:"Quotations",      icon:"💬" },
  { key:"Approvals",       icon:"✅" },
  { key:"Purchase orders", icon:"📦" },
  { key:"Invoices",        icon:"🧾" },
  { key:"Reports",         icon:"📊" },
  { key:"Activity",        icon:"⚡" },
];

function Shell({ user, onLogout }) {
  const [active, setActive] = useState("Dashboard");
  const initials = ((user.firstName||"")[0]+(user.lastName||"")[0]).toUpperCase();

  const renderPage = () => {
    switch (active) {
      case "Dashboard": return <DashboardPage user={user} onNavigate={setActive}/>;
      case "Vendors":   return <VendorsPage/>;
      case "RFQ's":     return <RFQPage/>;
      default:
        return (
          <div className="coming-soon">
            <div style={{fontSize:40}}>🚧</div>
            <div className="page-title" style={{fontSize:18}}>{active}</div>
            <div style={{fontSize:13,color:"var(--muted)"}}>Coming soon</div>
          </div>
        );
    }
  };

  return (
    <div className="shell">
      <style>{css}</style>

      {/* Top bar */}
      <div className="topbar">
        <span className="topbar-brand">VendorBridge</span>
        <div className="topbar-center"/>
        <span className="topbar-pill">{user.firstName} {user.lastName}</span>
        <div className="topbar-avatar" title="Click to sign out" onClick={onLogout}>
          {user.photo ? <img src={user.photo} alt="av"/> : initials}
        </div>
      </div>

      <div className="shell-body">
        {/* Sidebar */}
        <nav className="sidebar">
          {NAV.map(n => (
            <div key={n.key} className={`nav-item${active===n.key?" active":""}`} onClick={()=>setActive(n.key)}>
              <span className="nav-icon">{n.icon}</span>
              {n.key}
            </div>
          ))}
        </nav>

        {/* Page */}
        <main className="page">{renderPage()}</main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("login");
  const [user,   setUser]   = useState(null);

  useEffect(() => {
    const u = Session.user();
    if (u) { setUser(u); setScreen("app"); }
  }, []);

  const onLogin  = u => { setUser(u); setScreen("app"); };
  const onLogout = () => { Session.clear(); setUser(null); setScreen("login"); };

  if (screen === "app" && user) {
    return <><style>{css}</style><Shell user={user} onLogout={onLogout}/></>;
  }

  return (
    <>
      <style>{css}</style>
      {screen === "login"    && <LoginScreen    onLogin={onLogin} onSignup={()=>setScreen("register")} onForgot={()=>setScreen("forgot")}/>}
      {screen === "register" && <RegisterScreen onLogin={onLogin} onLoginSwitch={()=>setScreen("login")}/>}
      {screen === "forgot"   && <ForgotScreen   onBack={()=>setScreen("login")}/>}
    </>
  );
}
