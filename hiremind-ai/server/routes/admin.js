const router = require("express").Router();
const auth = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const Role = require("../models/Role");
const User = require("../models/User");
const Candidate = require("../models/Candidate");
const Interview = require("../models/Interview");

router.use(auth, requireRole("admin"));

router.post("/roles", async (req, res) => {
  const { title, requiredSkills, atsThreshold = 60, description } = req.body;
  const role = await Role.create({ title, requiredSkills, atsThreshold, description, createdBy: req.user.id });
  res.status(201).json(role);
});

router.put("/roles/:id", async (req, res) => {
  const role = await Role.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(role);
});

router.put("/roles/:id/threshold", async (req, res) => {
  const role = await Role.findByIdAndUpdate(req.params.id, { atsThreshold: req.body.threshold }, { new: true });
  res.json(role);
});

router.get("/stats", async (_req, res) => {
  const [totalUsers, totalCandidates, totalInterviews, totalRoles] = await Promise.all([
    User.countDocuments(),
    Candidate.countDocuments(),
    Interview.countDocuments({ status: "completed" }),
    Role.countDocuments(),
  ]);
  const recommended = await Interview.countDocuments({
    status: "completed",
    recommendation: { $in: ["Highly Recommended", "Recommended"] },
  });
  res.json({
    totalUsers, totalCandidates, totalInterviews, totalRoles, recommended,
    hireRate: totalInterviews > 0 ? Math.round((recommended / totalInterviews) * 100) : 0,
  });
});

router.post("/promote", async (req, res) => {
  const { userId, newRole } = req.body;
  if (!["candidate", "hr", "admin"].includes(newRole)) return res.status(400).json({ message: "Invalid role" });
  const user = await User.findByIdAndUpdate(userId, { role: newRole }, { new: true });
  res.json({ message: `User updated to ${user.role}`, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
});

router.get("/users", async (_req, res) => {
  const users = await User.find({}).select("name email role createdAt").sort({ createdAt: -1 });
  res.json(users);
});

module.exports = router;
