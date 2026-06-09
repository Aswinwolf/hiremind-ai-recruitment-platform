const { BEHAVIOR_ASSESSMENT_QUESTIONS, CATEGORY_LABELS } = require("../data/behaviorAssessmentQuestions");

const LIKERT_LABELS = {
  1: "Strongly Disagree",
  2: "Disagree",
  3: "Neutral",
  4: "Agree",
  5: "Strongly Agree",
};

function levelFromAvg(avg) {
  if (avg >= 4) return "High";
  if (avg >= 2.5) return "Moderate";
  return "Low";
}

function computeCategoryScores(answers) {
  const byCat = {};
  for (const q of BEHAVIOR_ASSESSMENT_QUESTIONS) {
    if (!byCat[q.category]) byCat[q.category] = [];
    const a = answers.find((x) => x.questionId === q.id);
    if (a?.value >= 1 && a.value <= 5) byCat[q.category].push(a.value);
  }
  const categoryScores = {};
  for (const [cat, vals] of Object.entries(byCat)) {
    categoryScores[cat] = vals.length
      ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 20)
      : 0;
  }
  return categoryScores;
}

function computeOverallScore(answers) {
  const vals = answers
    .map((a) => a.value)
    .filter((v) => v >= 1 && v <= 5);
  if (!vals.length) return 0;
  return vals.reduce((s, v) => s + v, 0);
}

function computeIndicators(categoryScores, answers) {
  const avg = (cat) => {
    const qs = BEHAVIOR_ASSESSMENT_QUESTIONS.filter((q) => q.category === cat);
    const vals = qs.map((q) => answers.find((a) => a.questionId === q.id)?.value).filter((v) => v >= 1);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };

  const decisionAvg = (avg("decisionMaking") + avg("leadershipPotential")) / 2 || avg("decisionMaking");

  return {
    confidence: levelFromAvg(decisionAvg),
    teamwork: levelFromAvg(avg("teamwork")),
    adaptability: levelFromAvg(avg("adaptability")),
    leadership: levelFromAvg(avg("leadershipPotential")),
    accountability: levelFromAvg(avg("accountability")),
    learningMindset: levelFromAvg(avg("learningMindset")),
    communication: levelFromAvg(avg("communication")),
  };
}

function recommendationFromScore(finalScore) {
  if (finalScore >= 90) return "Highly Recommended";
  if (finalScore >= 75) return "Recommended";
  if (finalScore >= 60) return "Consider with Training";
  return "Not Recommended";
}

function getQuestionsForClient() {
  return BEHAVIOR_ASSESSMENT_QUESTIONS.map((q) => ({
    id: q.id,
    category: q.category,
    categoryLabel: CATEGORY_LABELS[q.category] || q.category,
    text: q.text,
  }));
}

module.exports = {
  LIKERT_LABELS,
  CATEGORY_LABELS,
  BEHAVIOR_ASSESSMENT_QUESTIONS,
  computeCategoryScores,
  computeOverallScore,
  computeIndicators,
  recommendationFromScore,
  getQuestionsForClient,
  levelFromAvg,
};
