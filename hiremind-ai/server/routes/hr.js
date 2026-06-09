const router = require("express").Router();
const auth = require("../middleware/auth");
const { requireAny } = require("../middleware/rbac");
const Candidate = require("../models/Candidate");
const Interview = require("../models/Interview");
const Assessment = require("../models/Assessment");
const { generateReport } = require("../services/reportService");

router.use(auth);

router.get("/candidates", requireAny("hr", "admin"), async (_req, res) => {
  const candidates = await Candidate.find({}).populate("userId", "name email").lean();
  const result = await Promise.all(candidates.map(async c => {
    const iv = await Interview.findOne({ candidateId: c._id, status: "completed" }).sort({ completedAt: -1 }).lean();
    const assessment = iv ? await Assessment.findOne({ interviewId: iv._id, status: "completed" }).lean() : null;
    return {
      id: c._id,
      name: c.userId?.name,
      email: c.userId?.email,
      role: c.selectedRole,
      atsScore: c.atsScore,
      isEligible: c.isEligible,
      finalScore: iv?.finalScores?.finalScore || null,
      workplaceReadinessScore: iv?.finalScores?.workplaceReadinessScore ?? assessment?.overallScore ?? null,
      recommendation: iv?.recommendation || "Pending",
      interviewDate: iv?.completedAt || null,
      interviewId: iv?._id || null,
      hcs: iv?.decisionBrief?.hiringConfidenceScore || null,
      workplaceIndicators: assessment?.indicators || iv?.psychIndicators?.workplaceReadiness || null,
    };
  }));
  res.json(result);
});

router.get("/ranking/:role", requireAny("hr", "admin"), async (req, res) => {
  const candidates = await Candidate.find({ selectedRole: req.params.role }).populate("userId", "name email").lean();
  const ranked = (await Promise.all(candidates.map(async c => {
    const iv = await Interview.findOne({ candidateId: c._id, status: "completed" }).sort({ completedAt: -1 }).lean();
    const assessment = iv ? await Assessment.findOne({ interviewId: iv._id, status: "completed" }).lean() : null;
    return {
      candidateId: c._id,
      name: c.userId?.name,
      email: c.userId?.email,
      atsScore: c.atsScore,
      finalScore: iv?.finalScores?.finalScore || 0,
      workplaceReadinessScore: iv?.finalScores?.workplaceReadinessScore ?? assessment?.overallScore ?? 0,
      recommendation: iv?.recommendation || "Pending",
      hcs: iv?.decisionBrief?.hiringConfidenceScore || 0,
      workplaceIndicators: assessment?.indicators || null,
    };
  }))).sort((a, b) => b.finalScore - a.finalScore);
  res.json(ranked);
});

router.get("/search", requireAny("hr", "admin"), async (req, res) => {
  const { q = "", role, minAts, eligibleOnly } = req.query;
  const filter = {};
  if (role) filter.selectedRole = role;
  if (minAts) filter.atsScore = { $gte: Number(minAts) };
  if (eligibleOnly === "true") filter.isEligible = true;
  if (q) {
    filter.$or = [
      { "parsedResume.name":  { $regex: q, $options: "i" } },
      { "parsedResume.email": { $regex: q, $options: "i" } },
      { "parsedResume.skills": { $regex: q, $options: "i" } },
    ];
  }
  const rows = await Candidate.find(filter)
    .select("userId selectedRole atsScore isEligible parsedResume.name parsedResume.email parsedResume.skills")
    .sort({ atsScore: -1 })
    .limit(50)
    .populate({ path: "userId", select: "name email" })
    .lean();
  res.json(rows);
});

router.get("/brief/:interviewId", requireAny("hr", "admin"), async (req, res) => {
  const iv = await Interview.findById(req.params.interviewId)
    .select("decisionBrief finalScores recommendation selectedRole psychIndicators candidateId")
    .populate({ path: "candidateId", populate: { path: "userId", select: "name email" } });
  if (!iv) return res.status(404).json({ message: "Not found" });
  res.json(iv);
});

router.get("/report/:candidateId", requireAny("hr", "admin"), async (req, res) => {
  const candidate = await Candidate.findById(req.params.candidateId);
  const interview = await Interview.findOne({ candidateId: candidate?._id, status: "completed" }).sort({ completedAt: -1 });
  if (!candidate || !interview) return res.status(404).json({ message: "No completed interview" });
  const assessment = await Assessment.findOne({ interviewId: interview._id, status: "completed" });
  const filePath = await generateReport(candidate, interview, assessment);
  res.download(filePath, "HireMind_Report.pdf");
});

module.exports = router;
