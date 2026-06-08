/**
 * Unified question generation engine (§31)
 * Module 07 callers can keep calling generateQuestions(...).
 */
const { callJSON } = require("./gemini");
const {
  buildTechnicalInterviewPrompt,
  buildResumeInterviewPrompt,
  buildBehavioralInterviewPrompt,
} = require("../prompts");
const { nextLevel, difficultyHint } = require("./difficultyTuner");

const FALLBACK = {
  technical: [
    "Walk me through your understanding of REST API design.",
    "How would you approach debugging a production memory leak?",
    "Explain the difference between SQL and NoSQL with a use case.",
  ],
  resume: [
    "Tell me about a recent project you built — what was the hardest part?",
    "Which technology in your resume are you most confident about and why?",
    "Describe a bug you debugged that taught you something.",
  ],
  behavioral: [
    "Tell me about a time when you had a disagreement with a teammate.",
    "Describe a situation where you had to learn a new technology quickly.",
    "Walk me through a moment when you owned a failure on your team.",
  ],
};

async function generateQuestionsForRound({ role, parsedResume, atsResult, round, priorScores = [] }) {
  const level = nextLevel(priorScores);
  let prompt;
  if (round === "technical") prompt = buildTechnicalInterviewPrompt({ role, missingSkills: atsResult.missingSkills, difficulty: level });
  else if (round === "resume") prompt = buildResumeInterviewPrompt({ role, parsedResume, difficulty: level });
  else prompt = buildBehavioralInterviewPrompt({ role });

  const out = await callJSON(prompt + `\n\n(${difficultyHint(level)})`, { maxOutputTokens: 512, fallback: null });
  if (Array.isArray(out) && out.length >= 3 && out.every(q => typeof q === "string")) return out.slice(0, 3);
  return FALLBACK[round];
}

// Backwards-compatible facade (Module 07)
async function generateQuestions(role, parsedResume, atsResult, round = "technical") {
  return generateQuestionsForRound({ role, parsedResume, atsResult, round });
}

module.exports = { generateQuestionsForRound, generateQuestions };
