const {
  analyzePsychIndicators,
  analyzeBehavior,
} = require("./geminiService");
const decisionService = require("./decisionService");
const { recommendationFromScore } = require("./assessmentService");

function avgField(qs, field) {
  const v = qs.map((q) => q.scores?.[field] || 0);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) : 0;
}

/**
 * Final scoring after interview rounds + workplace readiness assessment.
 * Weights: ATS 20%, Technical 40%, Behavioral 20%, Communication 10%, Workplace Readiness 10%
 */
async function finalizeInterview(interview, candidate, assessment) {
  const answered = interview.questions.filter((q) => q.answer && !q.scores?._skipped);
  const psych = await analyzePsychIndicators(answered);
  const behavioralAnswers = answered.filter((q) => q.round === "behavioral");
  const behavior = await analyzeBehavior(behavioralAnswers);

  const techQs = interview.questions.filter((q) => q.round === "technical");
  const behavInterviewQs = interview.questions.filter((q) => q.round === "behavioral");

  const technicalScore = avgField(techQs, "technical");
  const behavioralInterviewScore = avgField(behavInterviewQs, "communication");
  const commScore = avgField(answered, "communication");
  const workplaceReadinessScore = assessment?.overallScore ?? 0;

  const finalScore = Math.round(
    (candidate.atsScore || 0) * 0.20 +
    technicalScore * 0.40 +
    behavioralInterviewScore * 0.20 +
    commScore * 0.10 +
    workplaceReadinessScore * 0.10
  );

  const recommendation = recommendationFromScore(finalScore);

  interview.status = "completed";
  interview.psychIndicators = {
    ...(psych || {}),
    behavioral: behavior || undefined,
    workplaceReadiness: assessment?.indicators || undefined,
  };
  interview.finalScores = {
    atsScore: candidate.atsScore,
    technicalScore,
    behavioralScore: behavioralInterviewScore,
    commScore,
    workplaceReadinessScore,
    finalScore,
  };
  interview.recommendation = recommendation;
  interview.completedAt = new Date();
  interview.progress.lastActivityAt = new Date();
  interview.session = interview.session || {};
  interview.session.isLocked = false;

  try {
    const brief = await decisionService.buildBrief({ candidate, interview, assessment });
    interview.decisionBrief = brief;
    if (brief.riskFactors.some((r) => ["PROMPT_INJECTION", "OFFENSIVE_CONTENT", "AI_ASSISTED_ANSWERS"].includes(r.code))) {
      interview.recommendation = "Not Recommended";
    }
  } catch (_) { /* best-effort */ }

  await interview.save();

  return {
    finalScore,
    recommendation: interview.recommendation,
    psychIndicators: interview.psychIndicators,
    scores: interview.finalScores,
    decisionBrief: interview.decisionBrief,
    assessment: assessment ? {
      overallScore: assessment.overallScore,
      categoryScores: assessment.categoryScores,
      indicators: assessment.indicators,
    } : null,
  };
}

module.exports = { finalizeInterview };
