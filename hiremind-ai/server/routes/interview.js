const router = require("express").Router();
const crypto = require("crypto");
const auth = require("../middleware/auth");
const Interview = require("../models/Interview");
const Candidate = require("../models/Candidate");
const {
  generateQuestionsForRound,
  evaluateAnswer,
  analyzePsychIndicators,
  analyzeBehavior,
} = require("../services/geminiService");
const { roundAverages, dimAvg } = require("../services/scoreAggregator");
const decisionService = require("../services/decisionService");
const lockService = require("../services/lockService");
const { scanOffensive, scanInjection, stripInjection } = require("../services/guardrails");

const ROUND_ORDER = ["technical", "resume", "behavioral"];

function detectRoundCompletion(questions) {
  const completed = [];
  for (const r of ROUND_ORDER) {
    const inRound = questions.filter(q => q.round === r);
    if (inRound.length > 0 && inRound.every(q => q.answer && q.answer.trim()))
      completed.push(r);
  }
  const currentRound = ROUND_ORDER.find(r => !completed.includes(r)) || "behavioral";
  return { roundsCompleted: completed, currentRound };
}

// POST /api/interview/start
router.post("/start", auth, async (req, res) => {
  try {
    const candidate = await Candidate.findOne({ userId: req.user.id });
    if (!candidate) return res.status(400).json({ message: "Please upload resume first" });
    if (!candidate.isEligible) return res.status(403).json({ message: "ATS score below threshold" });

    // Resume an existing in-progress interview
    const existing = await Interview.findOne({ userId: req.user.id, status: "in-progress" });
    if (existing) {
      const holder = crypto.randomUUID();
      await lockService.acquire(existing._id.toString(), holder);
      res.cookie("iv_lock", holder, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 1000 });
      return res.json({
        interviewId: existing._id,
        resumed: true,
        questions: existing.questions.map((q, i) => ({ index: i, question: q.question, round: q.round, answered: !!q.answer })),
      });
    }

    const atsResult = { atsScore: candidate.atsScore, missingSkills: candidate.missingSkills };
    const [techQs, resumeQs, behavQs] = await Promise.all([
      generateQuestionsForRound({ role: candidate.selectedRole, parsedResume: candidate.parsedResume, atsResult, round: "technical" }),
      generateQuestionsForRound({ role: candidate.selectedRole, parsedResume: candidate.parsedResume, atsResult, round: "resume" }),
      generateQuestionsForRound({ role: candidate.selectedRole, parsedResume: candidate.parsedResume, atsResult, round: "behavioral" }),
    ]);

    const allQs = [
      ...techQs.map(q => ({ question: q, round: "technical", answer: "", scores: {} })),
      ...resumeQs.map(q => ({ question: q, round: "resume", answer: "", scores: {} })),
      ...behavQs.map(q => ({ question: q, round: "behavioral", answer: "", scores: {} })),
    ];

    const interview = await Interview.create({
      candidateId: candidate._id,
      userId: req.user.id,
      selectedRole: candidate.selectedRole,
      questions: allQs,
      progress: { totalQuestions: allQs.length, currentRound: "technical", lastActivityAt: new Date() },
    });

    const holder = crypto.randomUUID();
    await lockService.acquire(interview._id.toString(), holder);
    res.cookie("iv_lock", holder, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 1000 });

    res.json({
      interviewId: interview._id,
      resumed: false,
      questions: allQs.map((q, i) => ({ index: i, question: q.question, round: q.round, answered: false })),
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/interview/answer
router.post("/answer", auth, async (req, res) => {
  try {
    const { interviewId, questionIndex, answer, signal } = req.body;
    if (!interviewId || typeof questionIndex !== "number" || typeof answer !== "string")
      return res.status(400).json({ message: "interviewId, questionIndex, answer required" });

    const lockHolder = req.cookies?.iv_lock;
    const lockOk = await lockService.renew(interviewId, lockHolder);
    if (!lockOk) return res.status(423).json({ message: "Interview is open in another session" });

    if (scanOffensive(answer)) return res.status(400).json({ message: "Your answer contains inappropriate language. Please rephrase." });
    const cleanAnswer = scanInjection(answer) ? stripInjection(answer) : answer;

    const interview = await Interview.findById(interviewId);
    if (!interview) return res.status(404).json({ message: "Interview not found" });
    if (interview.userId.toString() !== req.user.id) return res.status(403).json({ message: "Forbidden" });

    const q = interview.questions[questionIndex];
    if (!q) return res.status(400).json({ message: "Invalid questionIndex" });

    const priorScores = interview.questions
      .slice(0, questionIndex)
      .map(qq => qq.scores?.technical || 0)
      .filter(s => s > 0);

    const scored = await evaluateAnswer(q.question, cleanAnswer, interview.selectedRole, { round: q.round, priorScores });

    // paste-detection signals from frontend
    const { pasteCount = 0, keystrokes = 0 } = signal || {};
    const charsPerKey = keystrokes > 0 ? cleanAnswer.length / keystrokes : 0;
    if (pasteCount >= 1) scored.redFlags = Array.from(new Set([...scored.redFlags, "paste_detected"]));
    if (charsPerKey > 4 && keystrokes < 25) scored.redFlags = Array.from(new Set([...scored.redFlags, "paste_detected"]));

    interview.questions[questionIndex].answer = cleanAnswer;
    interview.questions[questionIndex].scores = {
      technical: scored.technical,
      communication: scored.communication,
      problemSolving: scored.problemSolving,
      confidence: scored.confidence,
      clarity: scored.clarity,
      practicalKnowledge: scored.practicalKnowledge,
      redFlags: scored.redFlags,
      _skipped: false,
    };

    const { roundsCompleted, currentRound } = detectRoundCompletion(interview.questions);
    const answeredCount = interview.questions.filter(qq => qq.answer && qq.answer.trim()).length;
    interview.progress.answeredCount = answeredCount;
    interview.progress.totalQuestions = interview.questions.length;
    interview.progress.currentIndex = Math.min(answeredCount, interview.questions.length - 1);
    interview.progress.roundsCompleted = roundsCompleted;
    interview.progress.currentRound = currentRound;
    interview.progress.lastActivityAt = new Date();
    interview.markModified("questions");

    // abuse counter
    const totalInjections = interview.questions.flatMap(qq => qq.scores?.redFlags || []).filter(f => f === "prompt_injection").length;
    if (totalInjections >= 3) interview.flags = Array.from(new Set([...(interview.flags || []), "ABUSIVE"]));

    await interview.save();
    res.json({ scores: scored, feedback: scored.feedback, progress: interview.progress });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/interview/skip
router.post("/skip", auth, async (req, res) => {
  try {
    const { interviewId, questionIndex, reason } = req.body;
    const iv = await Interview.findById(interviewId);
    if (!iv) return res.status(404).json({ message: "Not found" });
    if (iv.userId.toString() !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    if (!iv.questions[questionIndex]) return res.status(400).json({ message: "Invalid questionIndex" });

    iv.questions[questionIndex].answer = "[SKIPPED]";
    iv.questions[questionIndex].scores = { technical: 0, communication: 0, problemSolving: 0, confidence: 0, clarity: 0, practicalKnowledge: 0, redFlags: [], _skipped: true };
    iv.questions[questionIndex].meta = { ...(iv.questions[questionIndex].meta || {}), skipReason: reason || "no_reason" };
    iv.markModified("questions");
    await iv.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/interview/progress/:interviewId
router.get("/progress/:interviewId", auth, async (req, res) => {
  const iv = await Interview.findById(req.params.interviewId).select("progress status questions.round questions.answer");
  if (!iv) return res.status(404).json({ message: "Not found" });
  const total = iv.questions.length;
  const answered = iv.questions.filter(q => q.answer && q.answer.trim()).length;
  res.json({
    percent: total ? Math.round((answered / total) * 100) : 0,
    answered, total,
    currentRound: iv.progress.currentRound,
    roundsCompleted: iv.progress.roundsCompleted,
    status: iv.status,
  });
});

// POST /api/interview/complete
router.post("/complete", auth, async (req, res) => {
  try {
    const { interviewId } = req.body;
    const interview = await Interview.findById(interviewId);
    if (!interview) return res.status(404).json({ message: "Interview not found" });
    if (interview.userId.toString() !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    const candidate = await Candidate.findById(interview.candidateId);

    const answered = interview.questions.filter(q => q.answer && !q.scores?._skipped);
    const psych = await analyzePsychIndicators(answered);
    const behavioralAnswers = answered.filter(q => q.round === "behavioral");
    const behavior = await analyzeBehavior(behavioralAnswers);

    // Existing v1 score formula (preserved)
    const avg = (qs, field) => {
      const v = qs.map(q => q.scores?.[field] || 0);
      return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) : 0;
    };
    const techQs = interview.questions.filter(q => q.round === "technical");
    const behQs = interview.questions.filter(q => q.round !== "technical");
    const technicalScore = avg(techQs, "technical");
    const behavioralScore = avg(behQs, "communication");
    const commScore = avg(answered, "communication");
    const finalScore = Math.round(
      (candidate.atsScore || 0) * 0.20 +
      technicalScore * 0.40 +
      behavioralScore * 0.25 +
      commScore * 0.15
    );
    const rec = finalScore >= 80 ? "Highly Recommended" : finalScore >= 65 ? "Recommended" : "Needs Improvement";

    interview.status = "completed";
    interview.psychIndicators = { ...(psych || {}), behavioral: behavior || undefined };
    interview.finalScores = { atsScore: candidate.atsScore, technicalScore, behavioralScore, commScore, finalScore };
    interview.recommendation = rec;
    interview.completedAt = new Date();
    interview.progress.lastActivityAt = new Date();

    // §34 Decision brief
    try {
      const brief = await decisionService.buildBrief({ candidate, interview });
      interview.decisionBrief = brief;
      if (brief.riskFactors.some(r => ["PROMPT_INJECTION", "OFFENSIVE_CONTENT", "AI_ASSISTED_ANSWERS"].includes(r.code))) {
        interview.recommendation = "Needs Improvement";
      }
    } catch (e) {
      // best-effort; do not fail the request
    }

    await interview.save();
    await lockService.release(interview._id.toString(), req.cookies?.iv_lock);

    res.json({
      finalScore,
      recommendation: interview.recommendation,
      psychIndicators: interview.psychIndicators,
      scores: interview.finalScores,
      decisionBrief: interview.decisionBrief,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/interview/history
router.get("/history", auth, async (req, res) => {
  const rows = await Interview.find({ userId: req.user.id }).select("selectedRole status finalScores recommendation completedAt createdAt").sort({ createdAt: -1 });
  res.json(rows);
});

module.exports = router;
