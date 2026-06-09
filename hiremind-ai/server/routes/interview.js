const router = require("express").Router();
const crypto = require("crypto");
const auth = require("../middleware/auth");
const logger = require("../config/logger");
const Interview = require("../models/Interview");
const Candidate = require("../models/Candidate");
const {
  generateQuestionsForRound,
  evaluateAnswer,
} = require("../services/geminiService");
const Assessment = require("../models/Assessment");
const lockService = require("../services/lockService");
const { finalizeInterview } = require("../services/finalizeInterview");
const sessionService = require("../services/sessionService");
const { scanOffensive, scanInjection, stripInjection } = require("../services/guardrails");

const ROUND_ORDER = ["technical", "resume", "behavioral"];

function detectRoundCompletion(questions) {
  const completed = [];
  for (const r of ROUND_ORDER) {
    const inRound = questions.filter((q) => q.round === r);
    if (inRound.length > 0 && inRound.every((q) => q.answer && q.answer.trim()))
      completed.push(r);
  }
  const currentRound = ROUND_ORDER.find((r) => !completed.includes(r)) || "behavioral";
  return { roundsCompleted: completed, currentRound };
}

function syncProgress(interview) {
  const answeredCount = interview.questions.filter((q) => q.answer && q.answer.trim()).length;
  const { roundsCompleted, currentRound } = detectRoundCompletion(interview.questions);
  const nextIdx = sessionService.firstUnansweredIndex(interview);
  interview.progress.answeredCount = answeredCount;
  interview.progress.totalQuestions = interview.questions.length;
  interview.progress.currentIndex = nextIdx;
  interview.progress.roundsCompleted = roundsCompleted;
  interview.progress.currentRound = currentRound;
  interview.progress.lastActivityAt = new Date();
}

function setLockCookie(res, holder) {
  res.cookie("iv_lock", holder, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 1000,
  });
}

async function findActiveInterview(userId) {
  return Interview.findOne({ userId, status: "in-progress" });
}

async function respondWithInterview(res, interview, { resumed, req }) {
  const holder = crypto.randomUUID();
  await lockService.claim(interview._id.toString(), holder);
  setLockCookie(res, holder);

  if (resumed) {
    await sessionService.touchResumeSession(interview, req);
    logger.info(`Interview resumed userId=${req.user.id} interviewId=${interview._id} resumeCount=${interview.session?.resumeCount}`);
  } else {
    await sessionService.initNewSession(interview, req);
    logger.info(`Interview created userId=${req.user.id} interviewId=${interview._id}`);
  }

  return res.json(sessionService.buildStartPayload(interview, { resumed }));
}

// GET /api/interview/active — check for in-progress interview without creating
router.get("/active", auth, async (req, res) => {
  try {
    const existing = await findActiveInterview(req.user.id);
    if (existing) {
      return res.json({
        active: true,
        phase: "interview",
        interviewId: existing._id,
        progress: sessionService.buildStartPayload(existing, { resumed: true }).progress,
      });
    }

    const awaitingAssessment = await Interview.findOne({
      userId: req.user.id,
      status: { $in: ["assessment-pending", "assessment-in-progress"] },
    }).sort({ updatedAt: -1 });
    if (awaitingAssessment) {
      return res.json({
        active: true,
        phase: "assessment",
        interviewId: awaitingAssessment._id,
        status: awaitingAssessment.status,
      });
    }

    res.json({ active: false });
  } catch (e) {
    logger.error(`GET /active failed: ${e.message}`);
    res.status(500).json({ message: "Could not check interview status" });
  }
});

// POST /api/interview/start — resume existing or create new (idempotent on duplicate)
router.post("/start", auth, async (req, res) => {
  try {
    const candidate = await Candidate.findOne({ userId: req.user.id });
    if (!candidate) return res.status(400).json({ message: "Please upload resume first" });
    if (!candidate.isEligible) return res.status(403).json({ message: "ATS score below threshold" });

    let existing = await findActiveInterview(req.user.id);
    if (existing) {
      return respondWithInterview(res, existing, { resumed: true, req });
    }

    const atsResult = { atsScore: candidate.atsScore, missingSkills: candidate.missingSkills };
    logger.info(`Generating interview questions userId=${req.user.id} role=${candidate.selectedRole}`);

    const [techQs, resumeQs, behavQs] = await Promise.all([
      generateQuestionsForRound({ role: candidate.selectedRole, parsedResume: candidate.parsedResume, atsResult, round: "technical" }),
      generateQuestionsForRound({ role: candidate.selectedRole, parsedResume: candidate.parsedResume, atsResult, round: "resume" }),
      generateQuestionsForRound({ role: candidate.selectedRole, parsedResume: candidate.parsedResume, atsResult, round: "behavioral" }),
    ]);

    const allQs = [
      ...techQs.map((q) => ({ question: q, round: "technical", answer: "", scores: {} })),
      ...resumeQs.map((q) => ({ question: q, round: "resume", answer: "", scores: {} })),
      ...behavQs.map((q) => ({ question: q, round: "behavioral", answer: "", scores: {} })),
    ];

    // Re-check after slow Gemini calls — another request may have created first
    existing = await findActiveInterview(req.user.id);
    if (existing) {
      logger.warn(`Duplicate start avoided (pre-create check) userId=${req.user.id}`);
      return respondWithInterview(res, existing, { resumed: true, req });
    }

    let interview;
    try {
      interview = await Interview.create({
        candidateId: candidate._id,
        userId: req.user.id,
        selectedRole: candidate.selectedRole,
        questions: allQs,
        progress: { totalQuestions: allQs.length, currentRound: "technical", lastActivityAt: new Date() },
      });
    } catch (e) {
      if (e.code === 11000) {
        existing = await findActiveInterview(req.user.id);
        if (existing) {
          logger.warn(`E11000 recovered — reusing in-progress interview userId=${req.user.id}`);
          return respondWithInterview(res, existing, { resumed: true, req });
        }
      }
      throw e;
    }

    return respondWithInterview(res, interview, { resumed: false, req });
  } catch (e) {
    logger.error(`POST /start failed: ${e.message}`);
    const msg = e.code === 11000
      ? "An interview is already in progress. Refresh the page to resume."
      : (e.message || "Could not start interview");
    res.status(e.code === 11000 ? 409 : 500).json({ message: msg });
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
    if (!lockOk) return res.status(423).json({ message: "Interview is open in another session. Refresh to reclaim this session." });

    if (scanOffensive(answer)) return res.status(400).json({ message: "Your answer contains inappropriate language. Please rephrase." });
    const cleanAnswer = scanInjection(answer) ? stripInjection(answer) : answer;

    const interview = await Interview.findById(interviewId);
    if (!interview) return res.status(404).json({ message: "Interview not found" });
    if (interview.userId.toString() !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    if (interview.status !== "in-progress") return res.status(400).json({ message: "Interview is not active" });

    const q = interview.questions[questionIndex];
    if (!q) return res.status(400).json({ message: "Invalid questionIndex" });

    const priorScores = interview.questions
      .slice(0, questionIndex)
      .map((qq) => qq.scores?.technical || 0)
      .filter((s) => s > 0);

    const scored = await evaluateAnswer(q.question, cleanAnswer, interview.selectedRole, { round: q.round, priorScores });

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

    syncProgress(interview);
    interview.markModified("questions");

    const totalInjections = interview.questions.flatMap((qq) => qq.scores?.redFlags || []).filter((f) => f === "prompt_injection").length;
    if (totalInjections >= 3) interview.flags = Array.from(new Set([...(interview.flags || []), "ABUSIVE"]));

    await interview.save();
    logger.info(`Answer saved interviewId=${interviewId} q=${questionIndex} userId=${req.user.id}`);
    res.json({ scores: scored, feedback: scored.feedback, progress: interview.progress });
  } catch (e) {
    logger.error(`POST /answer failed: ${e.message}`);
    res.status(500).json({ message: e.message || "Failed to save answer" });
  }
});

// POST /api/interview/skip
router.post("/skip", auth, async (req, res) => {
  try {
    const { interviewId, questionIndex, reason } = req.body;
    const lockHolder = req.cookies?.iv_lock;
    const lockOk = await lockService.renew(interviewId, lockHolder);
    if (!lockOk) return res.status(423).json({ message: "Interview is open in another session. Refresh to reclaim this session." });

    const iv = await Interview.findById(interviewId);
    if (!iv) return res.status(404).json({ message: "Not found" });
    if (iv.userId.toString() !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    if (iv.status !== "in-progress") return res.status(400).json({ message: "Interview is not active" });
    if (!iv.questions[questionIndex]) return res.status(400).json({ message: "Invalid questionIndex" });

    iv.questions[questionIndex].answer = "[SKIPPED]";
    iv.questions[questionIndex].scores = { technical: 0, communication: 0, problemSolving: 0, confidence: 0, clarity: 0, practicalKnowledge: 0, redFlags: [], _skipped: true };
    iv.questions[questionIndex].meta = { ...(iv.questions[questionIndex].meta || {}), skipReason: reason || "no_reason" };
    syncProgress(iv);
    iv.markModified("questions");
    await iv.save();
    logger.info(`Question skipped interviewId=${interviewId} q=${questionIndex}`);
    res.json({ ok: true, progress: iv.progress });
  } catch (e) {
    logger.error(`POST /skip failed: ${e.message}`);
    res.status(500).json({ message: e.message || "Failed to skip" });
  }
});

// GET /api/interview/progress/:interviewId
router.get("/progress/:interviewId", auth, async (req, res) => {
  try {
    const iv = await Interview.findById(req.params.interviewId).select("progress status questions userId");
    if (!iv) return res.status(404).json({ message: "Not found" });
    if (iv.userId.toString() !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    const total = iv.questions.length;
    const answered = iv.questions.filter((q) => q.answer && q.answer.trim()).length;
    res.json({
      percent: total ? Math.round((answered / total) * 100) : 0,
      answered,
      total,
      currentIndex: sessionService.firstUnansweredIndex(iv),
      currentRound: iv.progress.currentRound,
      roundsCompleted: iv.progress.roundsCompleted,
      status: iv.status,
      questions: sessionService.formatQuestions(iv),
    });
  } catch (e) {
    logger.error(`GET /progress failed: ${e.message}`);
    res.status(500).json({ message: "Could not load progress" });
  }
});

// GET /api/interview/latest-result — fallback when sessionStorage is cleared
router.get("/latest-result", auth, async (req, res) => {
  try {
    const interview = await Interview.findOne({ userId: req.user.id, status: "completed" })
      .sort({ completedAt: -1 })
      .select("finalScores recommendation psychIndicators decisionBrief completedAt");
    if (!interview) return res.status(404).json({ message: "No completed interview found" });
    const assessment = await Assessment.findOne({ interviewId: interview._id, status: "completed" });
    res.json({
      finalScore: interview.finalScores?.finalScore,
      recommendation: interview.recommendation,
      psychIndicators: interview.psychIndicators,
      scores: interview.finalScores,
      decisionBrief: interview.decisionBrief,
      completedAt: interview.completedAt,
      assessment: assessment ? {
        overallScore: assessment.overallScore,
        categoryScores: assessment.categoryScores,
        indicators: assessment.indicators,
      } : null,
    });
  } catch (e) {
    logger.error(`GET /latest-result failed: ${e.message}`);
    res.status(500).json({ message: "Could not load result" });
  }
});

// POST /api/interview/finish-rounds — interview Q&A done → workplace assessment next
router.post("/finish-rounds", auth, async (req, res) => {
  try {
    const { interviewId } = req.body;
    const interview = await Interview.findById(interviewId);
    if (!interview) return res.status(404).json({ message: "Interview not found" });
    if (interview.userId.toString() !== req.user.id) return res.status(403).json({ message: "Forbidden" });

    const allAnswered = interview.questions.every((q) => q.answer && q.answer.trim());
    if (!allAnswered) {
      return res.status(400).json({ message: "Answer all interview questions before continuing" });
    }

    interview.status = "assessment-pending";
    interview.progress.lastActivityAt = new Date();
    await interview.save();
    await lockService.release(interview._id.toString(), req.cookies?.iv_lock);

    logger.info(`Interview rounds finished → assessment pending interviewId=${interviewId}`);
    res.json({ ok: true, interviewId: interview._id, nextStep: "/behavior-assessment" });
  } catch (e) {
    logger.error(`POST /finish-rounds failed: ${e.message}`);
    res.status(500).json({ message: e.message || "Could not finish interview rounds" });
  }
});

// POST /api/interview/complete — requires completed workplace assessment
router.post("/complete", auth, async (req, res) => {
  try {
    const { interviewId } = req.body;
    const interview = await Interview.findById(interviewId);
    if (!interview) return res.status(404).json({ message: "Interview not found" });
    if (interview.userId.toString() !== req.user.id) return res.status(403).json({ message: "Forbidden" });

    if (interview.status === "completed") {
      const assessment = await Assessment.findOne({ interviewId: interview._id, status: "completed" });
      return res.json({
        finalScore: interview.finalScores?.finalScore,
        recommendation: interview.recommendation,
        psychIndicators: interview.psychIndicators,
        scores: interview.finalScores,
        decisionBrief: interview.decisionBrief,
        assessment: assessment ? {
          overallScore: assessment.overallScore,
          categoryScores: assessment.categoryScores,
          indicators: assessment.indicators,
        } : null,
      });
    }

    const assessment = await Assessment.findOne({ interviewId: interview._id, status: "completed" });
    if (!assessment) {
      return res.status(400).json({
        message: "Complete the Workplace Readiness Assessment first.",
        redirect: "/behavior-assessment",
      });
    }

    const candidate = await Candidate.findById(interview.candidateId);
    const result = await finalizeInterview(interview, candidate, assessment);
    await lockService.release(interview._id.toString(), req.cookies?.iv_lock);
    logger.info(`Interview finalized interviewId=${interviewId} userId=${req.user.id}`);

    res.json(result);
  } catch (e) {
    logger.error(`POST /complete failed: ${e.message}`);
    res.status(500).json({ message: e.message || "Could not finalise interview" });
  }
});

// GET /api/interview/history
router.get("/history", auth, async (req, res) => {
  const rows = await Interview.find({ userId: req.user.id }).select("selectedRole status finalScores recommendation completedAt createdAt").sort({ createdAt: -1 });
  res.json(rows);
});

module.exports = router;
