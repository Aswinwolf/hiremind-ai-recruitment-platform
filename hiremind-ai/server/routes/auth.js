const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const zxcvbn = require("zxcvbn");

const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");

const ACCESS_TTL = "15m";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

function signAccess(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });
}

async function issueRefresh(user, { ip, ua }) {
  const raw = crypto.randomBytes(48).toString("hex");
  await RefreshToken.create({ userId: user._id, tokenHash: sha(raw), expiresAt: new Date(Date.now() + REFRESH_TTL_MS), ip, ua });
  return raw;
}

function setRefreshCookie(res, raw) {
  res.cookie("rt", raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: REFRESH_TTL_MS,
  });
}

function passwordPolicy(pw) {
  const MUST = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/];
  if (!pw || pw.length < 10) return "Password must be at least 10 characters.";
  if (!MUST.every(re => re.test(pw))) return "Password must contain upper, lower, number, and symbol.";
  const z = zxcvbn(pw);
  if (z.score < 3) return "Password is too guessable. " + (z.feedback?.suggestions?.[0] || "");
  return null;
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Missing fields" });
    const err = passwordPolicy(password);
    if (err) return res.status(400).json({ message: err });
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already registered" });
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashed });
    const access = signAccess(user);
    const refresh = await issueRefresh(user, { ip: req.ip, ua: req.get("user-agent") });
    setRefreshCookie(res, refresh);
    res.status(201).json({ token: access, user: { id: user._id, name, email, role: user.role } });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: "Invalid credentials" });
    const access = signAccess(user);
    const refresh = await issueRefresh(user, { ip: req.ip, ua: req.get("user-agent") });
    setRefreshCookie(res, refresh);
    res.json({ token: access, user: { id: user._id, name: user.name, email, role: user.role } });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/auth/refresh
router.post("/refresh", async (req, res) => {
  try {
    const raw = req.cookies?.rt;
    if (!raw) return res.status(401).json({ message: "No refresh token" });
    const rec = await RefreshToken.findOne({ tokenHash: sha(raw), revokedAt: null });
    if (!rec || rec.expiresAt < new Date()) return res.status(401).json({ message: "Invalid refresh" });
    const user = await User.findById(rec.userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    // rotate
    rec.revokedAt = new Date(); await rec.save();
    const newRaw = await issueRefresh(user, { ip: req.ip, ua: req.get("user-agent") });
    setRefreshCookie(res, newRaw);
    res.json({ token: signAccess(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/auth/logout
router.post("/logout", async (req, res) => {
  const raw = req.cookies?.rt;
  if (raw) await RefreshToken.updateOne({ tokenHash: sha(raw) }, { $set: { revokedAt: new Date() } });
  res.clearCookie("rt");
  res.json({ ok: true });
});

module.exports = router;
