# SECTION 36 — Enterprise Security Architecture

> **Scope:** Security hardening layered on top of the existing JWT + bcrypt auth (Module 01) and the existing routes. **No existing routes are renamed or removed** — additions only.

---

## 36.1 Rate Limiting

```javascript
// server/middleware/rateLimiters.js
const rateLimit = require("express-rate-limit");

const tooMany = (msg) => ({ status:429, message: msg });

exports.global = rateLimit({
  windowMs: 60_000, max: 120,
  standardHeaders: true, legacyHeaders: false,
  message: tooMany("Too many requests. Try again in a minute.")
});

exports.auth = rateLimit({
  windowMs: 15*60_000, max: 10,
  message: tooMany("Too many login attempts. Try again in 15 minutes."),
  skipSuccessfulRequests: true,
});

exports.upload = rateLimit({
  windowMs: 60*60_000, max: 20,
  message: tooMany("Upload limit reached for this hour.")
});

exports.interview = rateLimit({
  windowMs: 60_000, max: 30,
  message: tooMany("Slow down — too many answers in a short time.")
});
```

Apply selectively in `server/index.js`:

```javascript
const rl = require("./middleware/rateLimiters");
app.use(rl.global);
app.use("/api/auth", rl.auth);
app.use("/api/candidate/upload-resume", rl.upload);
app.use("/api/interview", rl.interview);
```

---

## 36.2 Helmet Security Headers

```javascript
const helmet = require("helmet");
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src":  ["'self'"],
      "script-src":   ["'self'", "'unsafe-inline'"],          // tighten with nonces in prod
      "img-src":      ["'self'", "data:", "https:"],
      "connect-src":  ["'self'", process.env.PARSER_URL || ""],
      "frame-ancestors": ["'none'"],
    }
  },
  crossOriginResourcePolicy: { policy: "same-site" },
  referrerPolicy: { policy: "no-referrer" }
}));
```

---

## 36.3 Input Sanitization

Already covered in §35.2 (`xss` + `express-mongo-sanitize`). Mounted **before** all routes.

---

## 36.4 Password Policies

```javascript
// server/utils/passwordPolicy.js
const zxcvbn = require("zxcvbn");
const MIN = 10;
const MUST = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/];

function validate(pw) {
  if (!pw || pw.length < MIN)                 return "Password must be at least 10 characters.";
  if (!MUST.every(re => re.test(pw)))         return "Password must contain upper, lower, number, and symbol.";
  const z = zxcvbn(pw);
  if (z.score < 3)                            return "Password is too guessable. " + (z.feedback?.suggestions?.[0] || "");
  return null;
}

module.exports = { validate };
```

Wire into `/api/auth/register`:

```javascript
const policy = require("../utils/passwordPolicy");
const err = policy.validate(password);
if (err) return res.status(400).json({ message: err });
```

Bcrypt rounds raised to **12** (already in Module 01) and stored as `argon2id` is optional via `argon2` lib if you want to upgrade — out-of-scope for v1.

---

## 36.5 Audit Logs

```javascript
// server/models/AuditLog.js
const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref:"User", index: true },
  action:   { type: String, required: true, index: true },        // e.g. "login.success"
  resource: { type: String, default: null },                      // e.g. "interview:<id>"
  ip:       String,
  userAgent:String,
  payload:  mongoose.Schema.Types.Mixed,
  at:       { type: Date, default: Date.now, index: true },
});
module.exports = mongoose.model("AuditLog", schema);
```

```javascript
// server/middleware/audit.js
const AuditLog = require("../models/AuditLog");
function audit(action, getResource = () => null) {
  return async (req, _res, next) => {
    try {
      await AuditLog.create({
        userId: req.user?.id, action,
        resource: getResource(req),
        ip: req.ip, userAgent: req.get("user-agent"),
        payload: { params: req.params, body: redact(req.body) },
      });
    } catch (_) {}
    next();
  };
}
function redact(b={}) { const c = {...b}; ["password","newPassword","token"].forEach(k => k in c && (c[k]="[REDACTED]")); return c; }
module.exports = { audit };
```

Usage:

```javascript
router.post("/login",  audit("auth.login.attempt"),  /* existing handler */);
router.post("/upload-resume", auth, audit("candidate.resume.upload"), upload.single("resume"), /* handler */);
router.put("/roles/:id", auth, adminOnly, audit("admin.role.update", r => `role:${r.params.id}`), /* handler */);
```

---

## 36.6 Secure File Upload Validation

```javascript
// server/middleware/upload.js — REPLACE the existing fileFilter block (additive checks)
const fs = require("fs"); const path = require("path");
const MAX = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["application/pdf"]);
const ALLOWED_EXT  = new Set([".pdf"]);
const PDF_MAGIC = Buffer.from("%PDF-");

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext))
    return cb(new Error("Only PDF files are allowed"), false);
  if (file.originalname.length > 120)
    return cb(new Error("Filename too long"), false);
  cb(null, true);
};

// After multer saves the file, verify magic bytes:
async function verifyPdfMagic(filePath) {
  const fd = await fs.promises.open(filePath, "r");
  const buf = Buffer.alloc(5); await fd.read(buf, 0, 5, 0); await fd.close();
  if (!buf.equals(PDF_MAGIC)) { await fs.promises.unlink(filePath); throw new Error("Invalid PDF signature"); }
}

module.exports = multer({ storage, fileFilter, limits: { fileSize: MAX } });
module.exports.verifyPdfMagic = verifyPdfMagic;
```

Call `verifyPdfMagic(req.file.path)` immediately after `upload.single("resume")` middleware in the existing route.

Additionally:

* Files are saved under `/uploads/<userId>/<uuid>.pdf` (already partially in Module 03 — the new code uses `crypto.randomUUID()` for the name to prevent enumeration).
* Static serving of `/uploads/` is **removed** from production; replaced by signed-URL download via `GET /api/candidate/resume-file` (auth + ownership check).

---

## 36.7 JWT Refresh Tokens

Two-token scheme: short-lived **access** (15 min) + long-lived **refresh** (7 days) stored as `httpOnly` cookie + DB row.

```javascript
// server/models/RefreshToken.js
const mongoose = require("mongoose");
module.exports = mongoose.model("RefreshToken", new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref:"User", index:true, required:true },
  tokenHash:{ type:String, required:true, unique:true },
  revokedAt:Date,
  expiresAt:{ type:Date, required:true, index:true },
  ua:String, ip:String,
}));
```

```javascript
// server/services/tokenService.js
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const RT = require("../models/RefreshToken");

const ACCESS_TTL  = "15m";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

function signAccess(user) {
  return jwt.sign({ id:user._id, role:user.role }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });
}

async function issueRefresh(user, { ip, ua }) {
  const raw = crypto.randomBytes(48).toString("hex");
  await RT.create({ userId:user._id, tokenHash: sha(raw), expiresAt: new Date(Date.now()+REFRESH_TTL_MS), ip, ua });
  return raw;
}

async function rotateRefresh(rawIncoming, user, ctx) {
  const old = await RT.findOne({ tokenHash: sha(rawIncoming), userId: user._id, revokedAt: null });
  if (!old || old.expiresAt < new Date()) throw new Error("Refresh invalid");
  old.revokedAt = new Date(); await old.save();
  return issueRefresh(user, ctx);
}

module.exports = { signAccess, issueRefresh, rotateRefresh, sha };
```

```javascript
// server/routes/auth.js — APPEND
router.post("/refresh", async (req,res) => {
  const raw = req.cookies?.rt;
  if (!raw) return res.status(401).json({ message:"No refresh token" });
  const rec = await RefreshToken.findOne({ tokenHash: sha(raw), revokedAt:null });
  if (!rec || rec.expiresAt < new Date()) return res.status(401).json({ message:"Invalid refresh" });
  const user = await User.findById(rec.userId);
  const newRaw = await rotateRefresh(raw, user, { ip:req.ip, ua:req.get("user-agent") });
  res.cookie("rt", newRaw, { httpOnly:true, sameSite:"strict", secure: process.env.NODE_ENV==="production", maxAge: REFRESH_TTL_MS });
  res.json({ accessToken: signAccess(user) });
});

router.post("/logout", async (req,res) => {
  const raw = req.cookies?.rt;
  if (raw) await RefreshToken.updateOne({ tokenHash: sha(raw) }, { $set: { revokedAt: new Date() } });
  res.clearCookie("rt"); res.json({ ok:true });
});
```

Existing `/login` and `/register` are updated to additionally issue a refresh cookie. Existing clients that ignore the cookie still work with the access token in the response body.

---

## 36.8 RBAC Authorization

```javascript
// server/middleware/rbac.js
const ROLES = { candidate: 1, hr: 2, admin: 3 };
function requireRole(min) {
  return (req, res, next) => {
    const lvl = ROLES[req.user?.role] || 0;
    if (lvl < ROLES[min]) return res.status(403).json({ message: "Forbidden" });
    next();
  };
}
function requireAny(...roles) {
  return (req,res,next) => roles.includes(req.user?.role) ? next() : res.status(403).json({ message:"Forbidden" });
}
module.exports = { requireRole, requireAny, ROLES };
```

Replace the inline `hrOnly` / `adminOnly` checks with:

```javascript
const { requireAny, requireRole } = require("../middleware/rbac");
router.get("/candidates", auth, requireAny("hr","admin"), /* ... */);
router.put("/roles/:id", auth, requireRole("admin"), /* ... */);
```

Existing function-style guards still work — these are drop-in alternatives.

---

## 36.9 CORS hardening

```javascript
app.use(cors({
  origin: (origin, cb) => {
    const allowed = (process.env.CORS_ORIGINS || "http://localhost:3000").split(",");
    if (!origin || allowed.includes(origin)) cb(null, true);
    else cb(new Error("CORS blocked: " + origin));
  },
  credentials: true
}));
```
