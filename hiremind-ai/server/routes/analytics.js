const router = require("express").Router();
const auth = require("../middleware/auth");
const { requireAny } = require("../middleware/rbac");
const Interview = require("../models/Interview");
const Candidate = require("../models/Candidate");

router.use(auth, requireAny("hr", "admin"));

router.get("/interviews", async (_req, res) => {
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [total, completed, avgScore, byRole] = await Promise.all([
    Interview.countDocuments({ createdAt: { $gte: last30 } }),
    Interview.countDocuments({ status: "completed", completedAt: { $gte: last30 } }),
    Interview.aggregate([
      { $match: { status: "completed", completedAt: { $gte: last30 } } },
      { $group: { _id: null, avg: { $avg: "$finalScores.finalScore" } } },
    ]),
    Interview.aggregate([
      { $match: { status: "completed", completedAt: { $gte: last30 } } },
      { $group: {
          _id: "$selectedRole",
          count: { $sum: 1 },
          avg: { $avg: "$finalScores.finalScore" },
          rec:  { $sum: { $cond: [{ $in: ["$recommendation", ["Highly Recommended", "Recommended"]] }, 1, 0] } },
      }},
    ]),
  ]);
  res.json({ window: "30d", total, completed, avgScore: Math.round(avgScore[0]?.avg || 0), byRole });
});

router.get("/ats", async (_req, res) => {
  const data = await Candidate.aggregate([
    { $group: {
        _id: "$selectedRole",
        avg: { $avg: "$atsScore" },
        eligible: { $sum: { $cond: ["$isEligible", 1, 0] } },
        total: { $sum: 1 },
    }},
    { $project: {
        _id: 0,
        role: "$_id",
        avg: { $round: ["$avg", 1] },
        eligible: 1, total: 1,
        eligibilityRate: { $round: [{ $multiply: [{ $divide: ["$eligible", { $cond: [{ $eq: ["$total", 0] }, 1, "$total"] }] }, 100] }, 1] },
    }},
  ]);
  res.json(data);
});

module.exports = router;
