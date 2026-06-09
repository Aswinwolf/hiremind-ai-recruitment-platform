const router = require("express").Router();
const auth = require("../middleware/auth");
const logger = require("../config/logger");
const Assessment = require("../models/Assessment");
const Interview = require("../models/Interview");
const Candidate = require("../models/Candidate");
const lockService = require("../services/lockService");
const {
  getQuestionsForClient,
  LIKERT_LABELS,
  BEHAVIOR_ASSESSMENT_QUESTIONS,
  computeCategoryScores,
  computeOverallScore,
  computeIndicators,
} = require("../services/assessmentService");
const { finalizeInterview } = require("../services/finalizeInterview");

const TOTAL = BEHAVIOR_ASSESSMENT_QUESTIONS.length;

async function getPendingInterview(userId) {
  return Interview.findOne({
    userId,
    status: { $in: ["assessment-pending", "assessment-in-progress"] },
  }).sort({ updatedAt: -1 });
}

// GET /api/behavior-assessment/status
router.get("/status", auth, async (req, res) => {
  try {
    const completed = await Assessment.findOne({ userId: req.user.id, status: "completed" })
      .sort({ completedAt: -1 })
      .select("overallScore status completedAt interviewId");
    if (completed) {
      return res.json({
        status: "completed",
        overallScore: completed.overallScore,
        completedAt: completed.completedAt,
        interviewId: completed.interviewId,
      });
    }

    const inProgress = await Assessment.findOne({ userId: req.user.id, status: "in-progress" })
      .sort({ updatedAt: -1 });
    if (inProgress) {
      const answered = inProgress.answers.filter((a) => a.value >= 1).length;
      return res.json({
        status: "in-progress",
        interviewId: inProgress.interviewId,
        currentIndex: inProgress.currentIndex,
        answered,
        total: TOTAL,
      });
    }

    const pendingIv = await getPendingInterview(req.user.id);
    if (pendingIv) {
      return res.json({
        status: "not-started",
        interviewId: pendingIv._id,
        message: "Complete the workplace readiness assessment to receive your final report.",
      });
    }

    res.json({ status: "unavailable", message: "Finish your interview rounds first." });
  } catch (e) {
    logger.error(`GET behavior-assessment/status: ${e.message}`);
    res.status(500).json({ message: "Could not load assessment status" });
  }
});

// GET /api/behavior-assessment/questions
router.get("/questions", auth, (_req, res) => {
  res.json({ questions: getQuestionsForClient(), likert: LIKERT_LABELS, total: TOTAL });
});

// POST /api/behavior-assessment/start
router.post("/start", auth, async (req, res) => {
  try {
    const { interviewId } = req.body;
    let interview = interviewId
      ? await Interview.findById(interviewId)
      : await getPendingInterview(req.user.id);

    if (!interview) return res.status(404).json({ message: "No interview awaiting assessment" });
    if (interview.userId.toString() !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    if (!["assessment-pending", "assessment-in-progress"].includes(interview.status)) {
      return res.status(400).json({ message: "Interview is not ready for workplace assessment" });
    }

    let assessment = await Assessment.findOne({ interviewId: interview._id });
    if (!assessment) {
      assessment = await Assessment.create({
        userId: req.user.id,
        interviewId: interview._id,
        answers: [],
        currentIndex: 0,
        status: "in-progress",
      });
    }

    interview.status = "assessment-in-progress";
    await interview.save();

    res.json({
      assessmentId: assessment._id,
      interviewId: interview._id,
      questions: getQuestionsForClient(),
      likert: LIKERT_LABELS,
      answers: assessment.answers,
      currentIndex: assessment.currentIndex,
      total: TOTAL,
    });
  } catch (e) {
    logger.error(`POST behavior-assessment/start: ${e.message}`);
    res.status(500).json({ message: e.message || "Could not start assessment" });
  }
});

// PATCH /api/behavior-assessment/progress — auto-save
router.patch("/progress", auth, async (req, res) => {
  try {
    const { interviewId, answers, currentIndex } = req.body;
    const assessment = await Assessment.findOne({ interviewId, userId: req.user.id, status: "in-progress" });
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });

    if (Array.isArray(answers)) {
      assessment.answers = answers.map((a) => ({
        questionId: a.questionId,
        category: BEHAVIOR_ASSESSMENT_QUESTIONS.find((q) => q.id === a.questionId)?.category,
        value: a.value,
      }));
    }
    if (typeof currentIndex === "number") assessment.currentIndex = currentIndex;
    assessment.updatedAt = new Date();
    await assessment.save();

    res.json({ ok: true, currentIndex: assessment.currentIndex, saved: assessment.answers.length });
  } catch (e) {
    logger.error(`PATCH behavior-assessment/progress: ${e.message}`);
    res.status(500).json({ message: e.message || "Could not save progress" });
  }
});

// GET /api/behavior-assessment/resume/:interviewId
router.get("/resume/:interviewId", auth, async (req, res) => {
  try {
    const assessment = await Assessment.findOne({
      interviewId: req.params.interviewId,
      userId: req.user.id,
    });
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });
    if (assessment.status === "completed") {
      return res.status(400).json({ message: "Assessment already completed", status: "completed" });
    }

    res.json({
      assessmentId: assessment._id,
      interviewId: assessment.interviewId,
      questions: getQuestionsForClient(),
      likert: LIKERT_LABELS,
      answers: assessment.answers,
      currentIndex: assessment.currentIndex,
      total: TOTAL,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/behavior-assessment/submit
router.post("/submit", auth, async (req, res) => {
  try {
    const { interviewId, answers } = req.body;
    const interview = await Interview.findById(interviewId);
    if (!interview) return res.status(404).json({ message: "Interview not found" });
    if (interview.userId.toString() !== req.user.id) return res.status(403).json({ message: "Forbidden" });

    let assessment = await Assessment.findOne({ interviewId });
    if (!assessment) return res.status(404).json({ message: "Start assessment first" });

    const normalized = (answers || assessment.answers).map((a) => ({
      questionId: a.questionId,
      category: BEHAVIOR_ASSESSMENT_QUESTIONS.find((q) => q.id === a.questionId)?.category,
      value: Number(a.value),
    }));

    const missing = BEHAVIOR_ASSESSMENT_QUESTIONS.filter(
      (q) => !normalized.find((a) => a.questionId === q.id && a.value >= 1 && a.value <= 5)
    );
    if (missing.length) {
      return res.status(400).json({
        message: `Please answer all ${TOTAL} questions (${missing.length} remaining).`,
        missingIds: missing.map((q) => q.id),
      });
    }

    assessment.answers = normalized;
    assessment.categoryScores = computeCategoryScores(normalized);
    assessment.overallScore = computeOverallScore(normalized);
    assessment.indicators = computeIndicators(assessment.categoryScores, normalized);
    assessment.status = "completed";
    assessment.completedAt = new Date();
    await assessment.save();

    const candidate = await Candidate.findById(interview.candidateId);
    const result = await finalizeInterview(interview, candidate, assessment);
    await lockService.release(interview._id.toString(), req.cookies?.iv_lock);

    logger.info(`Assessment completed userId=${req.user.id} score=${assessment.overallScore} final=${result.finalScore}`);

    res.json(result);
  } catch (e) {
    logger.error(`POST behavior-assessment/submit: ${e.message}`);
    res.status(500).json({ message: e.message || "Could not submit assessment" });
  }
});

module.exports = router;
