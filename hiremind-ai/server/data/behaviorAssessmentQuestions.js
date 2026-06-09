/**
 * Workplace Readiness & Behavioral Intelligence Assessment — 20 Likert items.
 * Scale: 1=Strongly Disagree … 5=Strongly Agree
 * Not a clinical or mental-health instrument — workplace self-assessment only.
 */
const BEHAVIOR_ASSESSMENT_QUESTIONS = [
  { id: 1, category: "teamwork", text: "I enjoy collaborating with team members." },
  { id: 2, category: "teamwork", text: "I actively support colleagues when they need help." },
  { id: 3, category: "teamwork", text: "I value diverse perspectives in team discussions." },
  { id: 4, category: "teamwork", text: "I handle team conflicts constructively." },
  { id: 5, category: "communication", text: "I express my ideas clearly in professional settings." },
  { id: 6, category: "communication", text: "I accept feedback positively." },
  { id: 7, category: "communication", text: "I listen attentively before responding." },
  { id: 8, category: "adaptability", text: "I can adapt quickly to changing requirements." },
  { id: 9, category: "adaptability", text: "I remain productive when priorities shift unexpectedly." },
  { id: 10, category: "adaptability", text: "I embrace new tools and processes willingly." },
  { id: 11, category: "accountability", text: "I take responsibility for mistakes." },
  { id: 12, category: "accountability", text: "I meet deadlines consistently." },
  { id: 13, category: "accountability", text: "I follow through on commitments." },
  { id: 14, category: "learningMindset", text: "I actively learn new technologies." },
  { id: 15, category: "learningMindset", text: "I seek opportunities to improve my skills." },
  { id: 16, category: "learningMindset", text: "I apply lessons from past experiences." },
  { id: 17, category: "leadershipPotential", text: "I motivate others toward shared goals." },
  { id: 18, category: "leadershipPotential", text: "I take initiative without being asked." },
  { id: 19, category: "decisionMaking", text: "I can make decisions under pressure." },
  { id: 20, category: "decisionMaking", text: "I stay motivated during difficult situations." },
];

const CATEGORY_LABELS = {
  teamwork: "Teamwork",
  communication: "Communication",
  adaptability: "Adaptability",
  accountability: "Accountability",
  learningMindset: "Learning Mindset",
  leadershipPotential: "Leadership Potential",
  decisionMaking: "Decision Making",
};

module.exports = { BEHAVIOR_ASSESSMENT_QUESTIONS, CATEGORY_LABELS };
