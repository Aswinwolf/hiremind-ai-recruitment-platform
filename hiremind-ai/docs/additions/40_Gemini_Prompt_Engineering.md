# SECTION 40 — Complete Gemini Prompt Engineering

> **Scope:** Production-grade prompts for **every** AI-driven step in HireMind AI. All prompts target **`gemini-2.5-flash`** and use the **JSON-only output discipline** already established in Module 07. Each prompt is delivered as a function in `server/prompts/*.js` and consumed by the existing `geminiService.js` / new services (§31–§34).

---

## 40.0 Global rules (apply to every prompt)

1. **Single output channel**: respond with **valid JSON only**, no markdown fences, no commentary.
2. **System role** (in user prompt): always declare "You are …" with a specific persona.
3. **Hard caps**: every numeric field is clamped server-side after the response.
4. **Refusal-resistant**: prompts say "if you cannot comply, return the same JSON shape with default values" — never let the model break the contract.
5. **Token budget**: `generationConfig.maxOutputTokens` is set per use:
   * Q-generation: 512, Evaluation: 256, Behavioral: 512, Decision: 1024, Recommendation: 256.

---

## 40.1 Resume Analysis

```javascript
// server/prompts/resumeAnalysis.js
function buildResumeAnalysisPrompt(rawText) {
  return `You are an expert technical recruiter. Analyse the resume below and extract structured data.

Resume (raw text):
"""${rawText.slice(0, 8000)}"""

Return ONLY valid JSON, no markdown:
{
  "fullName": "",
  "email": "",
  "phone": "",
  "yearsExperience": 0,
  "highestEducation": "",
  "skills":   ["..."],            // canonical names, lowercase
  "projects": [ { "name": "", "summary": "", "technologies": ["..."] } ],
  "certifications": ["..."],
  "achievements": ["..."],
  "redFlags": []                  // e.g. ["unclear_dates","no_quantifiable_impact"]
}

Rules:
- Use ONLY information present in the resume; do not infer technologies that aren't mentioned.
- Skill names must be canonical: "react" not "ReactJS", "node.js" not "node js".
- Empty/unknown fields → "" or [].`;
}
module.exports = { buildResumeAnalysisPrompt };
```

---

## 40.2 ATS Evaluation (Gemini-assisted, optional)

The deterministic ATS calc (Module 05) stays. This prompt **augments** it with semantic skill matching.

```javascript
// server/prompts/atsEvaluation.js
function buildATSPrompt({ candidateSkills, requiredSkills, role }) {
  return `You are an ATS engine for a ${role} role.

Required skills: ${JSON.stringify(requiredSkills)}
Candidate skills: ${JSON.stringify(candidateSkills)}

For EACH required skill, decide whether the candidate has it.
Treat synonyms as matches: "node" == "node.js", "postgres" == "postgresql", "k8s" == "kubernetes".

Return ONLY valid JSON:
{
  "matches":  [ { "required": "...", "matchedAs": "...", "confidence": 0.0 } ],
  "missing":  [ "..." ],
  "semanticMatchPercent": 0
}

Confidence in [0,1]. semanticMatchPercent in [0,100].`;
}
module.exports = { buildATSPrompt };
```

`atsScore = round(0.5 × keywordPercent + 0.5 × semanticMatchPercent)` — falls back to keyword-only when Gemini fails.

---

## 40.3 Resume-Based Interview

```javascript
// server/prompts/resumeInterview.js
function buildResumeInterviewPrompt({ role, parsedResume, difficulty }) {
  const projects = (parsedResume.projects || []).slice(0,3)
    .map(p => `- ${p.name || ""}: ${p.summary || ""} [tech: ${(p.technologies||[]).join(", ")}]`).join("\n");
  return `You are a senior ${role} interviewer.
The candidate's actual projects:
${projects || "(no projects listed)"}

Generate 3 INTERVIEW QUESTIONS that drill into the candidate's OWN projects.
Difficulty: ${difficulty}. Questions must reference the projects by name.

Return ONLY a JSON array of 3 strings, no markdown.`;
}
module.exports = { buildResumeInterviewPrompt };
```

---

## 40.4 Technical Interview

```javascript
// server/prompts/technicalInterview.js
function buildTechnicalInterviewPrompt({ role, missingSkills, difficulty }) {
  return `You are a senior ${role} interviewer.

Generate 3 technical interview questions for the ${role} role at "${difficulty}" difficulty.
- Question 1: core fundamentals every ${role} must know.
- Question 2: scenario / system-design / debugging-style.
- Question 3: targets ONE of the candidate's missing skills (${missingSkills.join(", ") || "none"}). If "none", ask an advanced senior-level question instead.

Avoid trivia. Each question must be answerable in 60–120 seconds of speech.

Return ONLY a JSON array of 3 strings.`;
}
module.exports = { buildTechnicalInterviewPrompt };
```

---

## 40.5 Behavioral Interview

```javascript
// server/prompts/behavioralInterview.js
function buildBehavioralInterviewPrompt({ role }) {
  return `You are a behavioural interviewer for a ${role} candidate.

Generate 3 BEHAVIOURAL questions using the STAR framework (Situation, Task, Action, Result).
Cover three different traits, picked from:
teamwork, leadership, adaptability, accountability, conflict resolution, learning mindset, decision making.

Each question must START with one of: "Tell me about a time when...", "Describe a situation where...", "Walk me through a moment when...".

Return ONLY a JSON array of 3 strings.`;
}
module.exports = { buildBehavioralInterviewPrompt };
```

---

## 40.6 Psychological Indicators

```javascript
// server/prompts/psychological.js
function buildPsychologicalPrompt(allAnswers) {
  const block = allAnswers.map((a,i)=>`Q${i+1}: ${a.question}\nA${i+1}: ${a.answer}`).join("\n\n");
  return `You are an occupational psychologist. Analyse these interview answers.

${block}

Return ONLY valid JSON:
{
  "confidence":       "High" | "Moderate" | "Low",
  "clarity":          "Clear Answers" | "Average" | "Poor",
  "collaboration":    "Strong Team Player" | "Average" | "Weak",
  "problemSolving":   "High" | "Medium" | "Low",
  "learningAttitude": "Excellent" | "Good" | "Average",
  "stressTolerance":  "High" | "Medium" | "Low",
  "selfAwareness":    "High" | "Medium" | "Low",
  "summary": "2-3 sentence professional summary"
}

Use evidence-based assessment. If insufficient evidence, return "Average"/"Medium" defaults.`;
}
module.exports = { buildPsychologicalPrompt };
```

The original Module 09 keys (`confidence`, `clarity`, `collaboration`, `problemSolving`, `learningAttitude`, `summary`) are **preserved**. New keys (`stressTolerance`, `selfAwareness`) are optional and feed §34.

---

## 40.7 Final Evaluation (sanity-check summary)

```javascript
// server/prompts/finalEvaluation.js
function buildFinalEvaluationPrompt({ role, rounds, behavioral, ats, missing, riskFactors }) {
  return `You are the lead hiring manager for a ${role} role producing the FINAL evaluation.

Inputs:
- ATS: ${ats}%
- Round averages (0-100): ${JSON.stringify(rounds)}
- Behavioural profile: ${JSON.stringify(behavioral || {})}
- Missing skills: ${missing.join(", ") || "none"}
- Risk factors: ${JSON.stringify(riskFactors || [])}

Return ONLY valid JSON:
{
  "verdict": "Highly Recommended" | "Recommended" | "Needs Improvement" | "Reject",
  "topReasons":  [ "...", "...", "..." ],
  "concerns":    [ "...", "..." ],
  "nextStep":    "schedule_onsite" | "additional_screen" | "reject" | "hold"
}

Hard rules:
- If risk factors include "PROMPT_INJECTION" or "OFFENSIVE_CONTENT" → verdict = "Reject", nextStep = "reject".
- If ATS < 40 → verdict ≤ "Needs Improvement".`;
}
module.exports = { buildFinalEvaluationPrompt };
```

The existing 3-band `recommendation` field is mapped from `verdict`:

```javascript
const MAP = { "Highly Recommended":"Highly Recommended", "Recommended":"Recommended", "Needs Improvement":"Needs Improvement", "Reject":"Needs Improvement" };
interview.recommendation = MAP[verdict] || interview.recommendation;
```

---

## 40.8 Recommendation Generation (candidate-facing)

```javascript
// server/prompts/recommendation.js
function buildRecommendationPrompt({ role, weaknesses, missingSkills }) {
  return `You are a friendly career coach writing recommendations for a ${role} candidate who just finished an AI mock interview.

Weaknesses observed: ${weaknesses.join(", ") || "none"}
Missing skills:      ${missingSkills.join(", ") || "none"}

Produce a candidate-facing improvement plan.

Return ONLY valid JSON:
{
  "shortTerm": [ "3 specific actions for the next 30 days" ],
  "midTerm":   [ "3 specific actions for the next 3 months" ],
  "resources": [ { "title":"...", "type":"course"|"book"|"docs"|"project", "why":"..." } ],
  "tone": "encouraging"
}

Do NOT invent URLs. Resources must be well-known (e.g. "MDN", "React official docs", "Designing Data-Intensive Applications").`;
}
module.exports = { buildRecommendationPrompt };
```

Surfaced in the existing Candidate Dashboard (Module 17) under "Recommended next steps".

---

## 40.9 Calling convention (one helper to rule them all)

```javascript
// server/services/gemini.js
const { geminiModel } = require("../config/gemini");
const { safeGenerate } = require("./geminiSafeCall");

async function callJSON(prompt, { maxOutputTokens=512 } = {}) {
  const r = await geminiModel.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens, temperature: 0.7, topK: 40, topP: 0.95 }
  });
  const text = r.response.text().trim().replace(/```json|```/g,"");
  try { return JSON.parse(text); }
  catch { return null; }
}

async function callText(prompt, opts) { return (await safeGenerate(prompt, opts)).text; }

module.exports = { callJSON, callText };
```

Every prompt module pairs with **one call** of `callJSON()`. Failure to parse falls back to a deterministic default — the contract on the caller never breaks.
