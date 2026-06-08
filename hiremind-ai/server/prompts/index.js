function buildTechnicalInterviewPrompt({ role, missingSkills = [], difficulty = "medium" }) {
  return `You are a senior ${role} interviewer.

Generate 3 technical interview questions for the "${role}" role at "${difficulty}" difficulty.
- Question 1: core fundamentals every ${role} must know.
- Question 2: scenario / system-design / debugging-style.
- Question 3: targets ONE of the candidate's missing skills (${missingSkills.join(", ") || "none"}). If "none", ask an advanced senior-level question instead.

Avoid trivia. Each question must be answerable in 60–120 seconds of speech.

Return ONLY a JSON array of 3 strings, no markdown.`;
}

function buildResumeInterviewPrompt({ role, parsedResume = {}, difficulty = "medium" }) {
  const projects = (parsedResume.projects || []).slice(0, 3).join(" | ");
  return `You are a senior ${role} interviewer.
Candidate's actual projects: ${projects || "(none listed)"}.

Generate 3 interview questions that drill into the candidate's OWN projects.
Difficulty: ${difficulty}. Probe HOW they built it, trade-offs, and what they'd change.

Return ONLY a JSON array of 3 strings, no markdown.`;
}

function buildBehavioralInterviewPrompt({ role }) {
  return `You are a behavioural interviewer for a ${role} candidate.

Generate 3 BEHAVIOURAL questions using the STAR framework.
Cover three different traits, picked from:
teamwork, leadership, adaptability, accountability, conflict resolution, learning mindset, decision making.

Each question must START with one of:
"Tell me about a time when...", "Describe a situation where...", "Walk me through a moment when...".

Return ONLY a JSON array of 3 strings, no markdown.`;
}

function buildEvaluationPrompt({ role, round, question, answer, level }) {
  return `You are a strict, fair ${role} interviewer evaluating a ${round} round answer.
Difficulty level: ${level}

Question: """${question}"""
Candidate answer: """${answer}"""

Score the answer 0-10 on each of these SIX dimensions:
- technical          (technical accuracy & depth)
- communication      (clarity of structure & vocabulary)
- problemSolving     (reasoning quality, alternative paths)
- confidence         (assertive, owns the answer, no excessive hedging)
- clarity            (explains complex ideas simply, no rambling)
- practicalKnowledge (real-world, hands-on, trade-off aware)

Rules:
- Empty / gibberish / off-topic answer => everything <= 2.
- Correct but very short => communication & clarity capped at 6.
- Answer copies the question back => everything <= 3.

Return ONLY valid JSON, no markdown:
{
  "technical": 0,
  "communication": 0,
  "problemSolving": 0,
  "confidence": 0,
  "clarity": 0,
  "practicalKnowledge": 0,
  "feedback": "one-sentence specific feedback",
  "redFlags": []
}`;
}

function buildPsychologicalPrompt(allAnswers = []) {
  const block = allAnswers.map((a, i) => `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer}`).join("\n\n");
  return `You are an occupational psychologist. Analyse these interview answers.

${block}

Return ONLY valid JSON:
{
  "confidence":       "High" | "Moderate" | "Low",
  "clarity":          "Clear Answers" | "Average" | "Poor",
  "collaboration":    "Strong Team Player" | "Average" | "Weak",
  "problemSolving":   "High" | "Medium" | "Low",
  "learningAttitude": "Excellent" | "Good" | "Average",
  "summary": "2-3 sentence professional summary"
}`;
}

function buildBehavioralPrompt(behavioralAnswers = []) {
  const block = behavioralAnswers.map((a, i) => `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer}`).join("\n\n");
  return `You are an occupational psychologist analysing behavioural interview answers.

Answers:
${block}

For EACH of these 7 traits output level + one-sentence evidence (paraphrase):

Allowed values:
- teamwork:           "Strong" | "Adequate" | "Weak"
- leadership:         "Demonstrated" | "Emerging" | "Not Shown"
- adaptability:       "High" | "Medium" | "Low"
- accountability:     "High" | "Medium" | "Low"
- conflictResolution: "Mature" | "Reactive" | "Avoidant"
- learningMindset:    "Growth" | "Fixed" | "Mixed"
- decisionMaking:     "Data-driven" | "Intuitive" | "Hesitant"

Also output overallBehaviorScore (0-100 integer).

Return ONLY valid JSON:
{
  "teamwork":           {"level":"...", "evidence":"..."},
  "leadership":         {"level":"...", "evidence":"..."},
  "adaptability":       {"level":"...", "evidence":"..."},
  "accountability":     {"level":"...", "evidence":"..."},
  "conflictResolution": {"level":"...", "evidence":"..."},
  "learningMindset":    {"level":"...", "evidence":"..."},
  "decisionMaking":     {"level":"...", "evidence":"..."},
  "overallBehaviorScore": 0
}`;
}

function buildDecisionPrompt({ role, atsResult, interview, behavior }) {
  const qa = (interview.questions || [])
    .filter(q => q.answer && !q.scores?._skipped)
    .slice(0, 12)
    .map(q => `[${q.round}] ${q.question}\n-> ${q.answer}`)
    .join("\n\n");
  return `You are a senior hiring manager writing a recruiter brief for a ${role} candidate.

ATS score: ${atsResult.atsScore}%
Missing skills: ${(atsResult.missingSkills || []).join(", ") || "none"}
Behavioural profile: ${JSON.stringify(behavior || {})}

Interview Q&A (truncated):
${qa}

Return ONLY valid JSON, no markdown:
{
  "strengths":         [ "3 to 5 concise bullets, evidence-based" ],
  "weaknesses":        [ "2 to 4 concise bullets, actionable" ],
  "interviewSummary":  "3-sentence recruiter-ready summary"
}`;
}

module.exports = {
  buildTechnicalInterviewPrompt,
  buildResumeInterviewPrompt,
  buildBehavioralInterviewPrompt,
  buildEvaluationPrompt,
  buildPsychologicalPrompt,
  buildBehavioralPrompt,
  buildDecisionPrompt,
};
