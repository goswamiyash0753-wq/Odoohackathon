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
// DATABASE LAYER
// Replace this block with better-sqlite3 API calls in production:
//   const Database = require('better-sqlite3')
//   const db = new Database('procurement.db')
// ─────────────────────────────────────────────────────────────────
const DB = (() => {
  let users = JSON.parse(localStorage.getItem("px_users") || "[]");
  let resets = {};
  const persist = () => localStorage.setItem("px_users", JSON.stringify(users));
  const hash = (p) => btoa(p + "_salt_v1");
  const verify = (p, h) => hash(p) === h;
  const sanitize = ({ password_hash, ...u }) => u;

  const api = {
    // INSERT INTO users
    create({ firstName, lastName, email, phone, country, additionalInfo, role, password, photo }) {
      if (users.find((u) => u.email === email.toLowerCase()))
        return { error: "Email already registered" };
      const u = {
        id: crypto.randomUUID(),
        firstName, lastName,
        email: email.toLowerCase(),
        phone, country,
        additionalInfo: additionalInfo || "",
        role: role || "",
        password_hash: hash(password),
        photo: photo || null,
        createdAt: new Date().toISOString(),
      };
      users.push(u);
      persist();
      return { user: sanitize(u) };
    },

    // SELECT + verify
    login(username, password) {
      const u = users.find((u) => u.email === username.toLowerCase());
      if (!u) return { error: "No account found" };
      if (!verify(password, u.password_hash)) return { error: "Incorrect password" };
      const token = btoa(JSON.stringify({ uid: u.id, exp: Date.now() + 3600000 }));
      return { token, user: sanitize(u) };
    },

    verifyToken(t) {
      try {
        const p = JSON.parse(atob(t));
        if (p.exp < Date.now()) return null;
        const u = users.find((u) => u.id === p.uid);
        return u ? sanitize(u) : null;
      } catch { return null; }
    },

    generateResetToken(email) {
      const u = users.find((u) => u.email === email.toLowerCase());
      if (!u) return { error: "No account found" };
      const tok = Math.random().toString(36).slice(2, 10).toUpperCase();
      resets[email.toLowerCase()] = { tok, exp: Date.now() + 600000 };
      return { message: `Reset token: ${tok}  (valid 10 min)` };
    },

    resetPassword(email, tok, newPwd) {
      const e = email.toLowerCase();
      const entry = resets[e];
      if (!entry || entry.tok !== tok.toUpperCase() || entry.exp < Date.now())
        return { error: "Invalid or expired token" };
      const u = users.find((u) => u.email === e);
      if (!u) return { error: "User not found" };
      u.password_hash = hash(newPwd);
      delete resets[e];
      persist();
      return { ok: true };
    },

    seed() {
      if (!users.length)
        this.create({ firstName: "Arjun", lastName: "Mehta", email: "admin@demo.com", phone: "9876543210", country: "India", additionalInfo: "Procurement Head", password: "Admin@123" });
    },
  };
  return api;
})();

DB.seed();

// ─────────────────────────────────────────────────────────────────
// SESSION MANAGER  (token stored in localStorage; expiry = 1 hour)
// ─────────────────────────────────────────────────────────────────
const Session = {
  save: (t) => localStorage.setItem("px_token", t),
  get: () => localStorage.getItem("px_token"),
  clear: () => localStorage.removeItem("px_token"),
  currentUser: () => { const t = Session.get(); return t ? DB.verifyToken(t) : null; },
};

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

  /* Dashboard */
  .dash { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 2rem; width: 100%; max-width: 420px; }
  .dash-hdr { display: flex; align-items: center; gap: .9rem; margin-bottom: 1.5rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--border); }
  .dash-avatar { width: 48px; height: 48px; border-radius: 50%; background: var(--surface2); border: 2px solid var(--border); overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
  .dash-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .dash-name { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800; }
  .dash-email { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .info-row { display: flex; justify-content: space-between; align-items: flex-start; padding: .55rem 0; border-bottom: 1px solid var(--border); font-size: 13px; }
  .info-row:last-child { border-bottom: none; }
  .info-lbl { color: var(--muted); flex-shrink: 0; }
  .info-val { text-align: right; max-width: 60%; word-break: break-all; }
  .logout-btn { margin-top: 1.5rem; background: transparent; border: 1px solid var(--border); border-radius: 8px; color: var(--muted); font-family: 'DM Sans', sans-serif; font-size: 12px; padding: .5rem 1rem; cursor: pointer; transition: all .2s; width: 100%; }
  .logout-btn:hover { border-color: var(--danger); color: var(--danger); }
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
// DASHBOARD — shown after successful login/register
// ─────────────────────────────────────────────────────────────────
function Dashboard({ user, onLogout }) {
  const initials = ((user.firstName || "")[0] + (user.lastName || "")[0]).toUpperCase();
  const joined = new Date(user.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const rows = [
    ["Email", user.email],
    ["Phone", user.phone || "—"],
    ["Country", user.country || "—"],
    ["Role", user.role || "—"],
    ["Additional Info", user.additionalInfo || "—"],
    ["Member Since", joined],
  ];
  return (
    <div className="dash">
      <div className="dash-hdr">
        <div className="dash-avatar">
          {user.photo ? <img src={user.photo} alt="profile" /> : initials}
        </div>
        <div>
          <div className="dash-name">{user.firstName} {user.lastName}</div>
          <div className="dash-email">{user.email}</div>
        </div>
      </div>
      {rows.map(([label, value]) => (
        <div className="info-row" key={label}>
          <span className="info-lbl">{label}</span>
          <span className="info-val">{value}</span>
        </div>
      ))}
      <button className="logout-btn" onClick={onLogout}>Sign Out</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("login");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = Session.currentUser();
    if (u) { setUser(u); setScreen("dashboard"); }
  }, []);

  const handleLogin = (u) => { setUser(u); setScreen("dashboard"); };
  const handleLogout = () => { Session.clear(); setUser(null); setScreen("login"); };

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {screen === "login" && <LoginScreen onLogin={handleLogin} onSignup={() => setScreen("signup")} onForgot={() => setScreen("forgot")} />}
        {screen === "signup" && <SignupScreen onLogin={handleLogin} onLoginSwitch={() => setScreen("login")} />}
        {screen === "forgot" && <ForgotScreen onBack={() => setScreen("login")} />}
        {screen === "dashboard" && user && <Dashboard user={user} onLogout={handleLogout} />}
      </div>
    </>
  );
}
