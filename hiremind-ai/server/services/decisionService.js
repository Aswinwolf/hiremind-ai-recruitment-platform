/**
 * Recruiter Decision Intelligence (§34)
 */
const { callJSON } = require("./gemini");
const { buildDecisionPrompt } = require("../prompts");
const { roundAverages, dimAvg } = require("./scoreAggregator");
const { score: behaviorScore } = require("./behavioralWeights");
const { detectRisks } = require("./riskDetector");

function calcConfidence({ ats, rounds, behavior, practical, comm, workplace, riskCount, skipped }) {
  const base = 0.25 * ats + 0.25 * rounds.technical + 0.15 * behavior + 0.10 * comm + 0.10 * practical + 0.15 * (workplace || 0);
  const penalty = Math.min(25, riskCount * 8 + skipped * 4);
  return Math.max(0, Math.min(100, Math.round(base - penalty)));
}

async function buildBrief({ candidate, interview, assessment }) {
  const atsResult = { atsScore: candidate.atsScore, missingSkills: candidate.missingSkills };
  const behavior  = interview.psychIndicators?.behavioral;
  const rounds    = roundAverages(interview.questions);

  const narrative = await callJSON(
    buildDecisionPrompt({ role: candidate.selectedRole, atsResult, interview, behavior }),
    { maxOutputTokens: 1024, fallback: { strengths: [], weaknesses: [], interviewSummary: "" } }
  );

  const { risks, skipped } = detectRisks(interview);
  const practicalAvg = dimAvg(interview.questions, "practicalKnowledge");
  const commAvg = dimAvg(interview.questions, "communication");
  const behavior100 = behaviorScore(behavior);
  const hcs = calcConfidence({
    ats: candidate.atsScore || 0,
    rounds,
    behavior: behavior100,
    practical: practicalAvg,
    comm: commAvg,
    workplace: assessment?.overallScore || interview.finalScores?.workplaceReadinessScore || 0,
    riskCount: risks.length,
    skipped,
  });

  return {
    strengths: narrative.strengths || [],
    weaknesses: narrative.weaknesses || [],
    missingSkills: candidate.missingSkills || [],
    riskFactors: risks,
    hiringConfidenceScore: hcs,
    interviewSummary: narrative.interviewSummary || "",
    generatedAt: new Date(),
  };
}

module.exports = { buildBrief, calcConfidence };
