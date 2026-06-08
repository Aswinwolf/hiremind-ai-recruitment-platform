/**
 * All Gemini-backed AI utilities used by routes/interview.js (Module 07)
 */
const { callJSON } = require("./gemini");
const {
  buildEvaluationPrompt,
  buildPsychologicalPrompt,
  buildBehavioralPrompt,
  buildDecisionPrompt,
} = require("../prompts");
const { runOutputGuards } = require("./guardrails");
const { nextLevel } = require("./difficultyTuner");
const { generateQuestions, generateQuestionsForRound } = require("./questionEngine");

const DIMS = ["technical", "communication", "problemSolving", "confidence", "clarity", "practicalKnowledge"];

async function evaluateAnswer(question, answer, role, opts = {}) {
  const level = opts.level || nextLevel(opts.priorScores || []);
  const round = opts.round || "technical";

  const prompt = buildEvaluationPrompt({ role, round, question, answer, level });
  const fb = { technical: 0, communication: 0, problemSolving: 0, confidence: 0, clarity: 0, practicalKnowledge: 0, feedback: "Could not evaluate answer", redFlags: ["parse_error"] };
  const parsed = await callJSON(prompt, { maxOutputTokens: 256, fallback: fb }) || fb;

  // clamp
  for (const d of DIMS) parsed[d] = Math.max(0, Math.min(10, Number(parsed[d] ?? 0)));
  parsed.redFlags = Array.isArray(parsed.redFlags) ? parsed.redFlags : [];
  parsed.redFlags = Array.from(new Set([...parsed.redFlags, ...runOutputGuards({ question, answer })]));

  // calibration safeguards
  if (answer && answer.trim().length < 15) for (const d of DIMS) parsed[d] = Math.min(parsed[d], 4);
  if (parsed.redFlags.includes("off_topic")) parsed.technical = Math.min(parsed.technical, 3);
  if (parsed.redFlags.includes("ai_generated")) { parsed.confidence = Math.min(parsed.confidence, 5); parsed.practicalKnowledge = Math.min(parsed.practicalKnowledge, 4); }

  return parsed;
}

async function analyzePsychIndicators(allAnswers) {
  if (!allAnswers?.length) return null;
  const prompt = buildPsychologicalPrompt(allAnswers);
  return await callJSON(prompt, { maxOutputTokens: 512, fallback: {
    confidence: "Moderate", clarity: "Average", collaboration: "Average",
    problemSolving: "Medium", learningAttitude: "Good", summary: "Insufficient data to summarise.",
  }});
}

async function analyzeBehavior(behavioralAnswers) {
  if (!behavioralAnswers?.length) return null;
  const prompt = buildBehavioralPrompt(behavioralAnswers);
  const data = await callJSON(prompt, { maxOutputTokens: 512, fallback: null });
  if (!data) return null;
  const keys = ["teamwork", "leadership", "adaptability", "accountability", "conflictResolution", "learningMindset", "decisionMaking"];
  const out = { evidence: {}, overallBehaviorScore: Math.max(0, Math.min(100, Number(data.overallBehaviorScore || 0))) };
  for (const k of keys) {
    out[k] = data[k]?.level || null;
    out.evidence[k] = data[k]?.evidence || null;
  }
  return out;
}

async function generateRecommendation(finalScore) {
  if (finalScore >= 80) return "Highly Recommended";
  if (finalScore >= 65) return "Recommended";
  return "Needs Improvement";
}

module.exports = {
  generateQuestions,
  generateQuestionsForRound,
  evaluateAnswer,
  analyzePsychIndicators,
  analyzeBehavior,
  generateRecommendation,
  buildDecisionPrompt,
};
