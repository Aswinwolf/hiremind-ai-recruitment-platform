/**
 * Difficulty tuning based on prior answer scores (§31.3)
 */
const LEVELS = ["easy", "medium", "hard", "expert"];

function nextLevel(prevScores = []) {
  if (!prevScores.length) return "medium";
  const last = prevScores.slice(-3);
  const avg = last.reduce((a, b) => a + b, 0) / last.length;
  if (avg >= 8.5) return "expert";
  if (avg >= 7.0) return "hard";
  if (avg >= 5.0) return "medium";
  return "easy";
}

function difficultyHint(level) {
  return ({
    easy:    "Use foundational questions a junior dev should know.",
    medium:  "Use practical scenario questions a mid-level dev should answer.",
    hard:    "Use multi-step reasoning, design trade-offs, edge cases.",
    expert:  "Use senior-level system design, optimisation, and failure-mode questions.",
  })[level];
}

module.exports = { nextLevel, difficultyHint, LEVELS };
