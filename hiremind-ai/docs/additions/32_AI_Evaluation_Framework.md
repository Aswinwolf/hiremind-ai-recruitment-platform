# SECTION 32 — AI Evaluation Framework

> **Scope:** Extends the existing `evaluateAnswer(...)` in `server/services/geminiService.js` (Module 07) from 4 dimensions to a **6-dimension** evaluation, while preserving the existing 4 keys (`technical`, `communication`, `confidence`, `problemSolving`) so all current downstream code (final-score formula, PDFKit report) continues to function unchanged.

---

## 32.1 Dimensions

| Dimension              | Key (JSON)            | Scale | Description                                              |
| :--------------------- | :-------------------- | :---- | :------------------------------------------------------- |
| Technical Accuracy     | `technical`           | 0–10  | Factual correctness, depth, mastery of concepts.         |
| Communication Skills   | `communication`       | 0–10  | Sentence structure, vocabulary, signposting.             |
| Problem Solving        | `problemSolving`      | 0–10  | Reasoning, decomposition, alternative consideration.     |
| Confidence             | `confidence`          | 0–10  | Assertiveness, ownership, lack of hedging.               |
| **Clarity** *(new)*    | `clarity`             | 0–10  | Ability to explain complex ideas simply, no rambling.    |
| **Practical Knowledge** *(new)* | `practicalKnowledge` | 0–10  | Hands-on, real-world, trade-off-aware experience.   |

> The 4 original keys remain the **canonical** inputs to the existing final-score formula. The 2 new keys feed §34 (Decision Intelligence) and §38 (Analytics).

---

## 32.2 Evaluation prompt (production-grade)

```javascript
// server/prompts/evaluation.js
function buildEvaluationPrompt({ role, round, question, answer, level }) {
  return `You are a strict, fair ${role} interviewer evaluating a ${round} round answer.
Difficulty level: ${level}

Question: """${question}"""
Candidate answer: """${answer}"""

Score the answer 0–10 on each of these SIX dimensions:
- technical          (technical accuracy & depth)
- communication      (clarity of structure & vocabulary)
- problemSolving     (reasoning quality, alt-paths considered)
- confidence         (assertive, owns the answer, no excessive hedging)
- clarity            (explains complex ideas simply, no rambling)
- practicalKnowledge (real-world, hands-on, trade-off aware)

Rules:
- If the answer is empty, gibberish, or off-topic, score everything ≤ 2.
- If the answer is correct but very short, cap communication & clarity at 6.
- If the answer copies the question back, score everything ≤ 3.
- Output ONLY valid JSON, no markdown, no commentary:

{
  "technical": 0,
  "communication": 0,
  "problemSolving": 0,
  "confidence": 0,
  "clarity": 0,
  "practicalKnowledge": 0,
  "feedback": "one-sentence specific feedback",
  "redFlags": [ "off_topic" | "too_short" | "rambling" | "memorized" | "uncertain" ]
}`;
}
module.exports = { buildEvaluationPrompt };
```

---

## 32.3 Upgraded `evaluateAnswer`

```javascript
// server/services/geminiService.js — replace ONLY evaluateAnswer
const { buildEvaluationPrompt } = require("../prompts/evaluation");
const { nextLevel } = require("./difficultyTuner");
const { runOutputGuards } = require("./guardrails");

async function evaluateAnswer(question, answer, role, opts = {}) {
  const level  = opts.level || nextLevel(opts.priorScores || []);
  const round  = opts.round || "technical";

  const prompt = buildEvaluationPrompt({ role, round, question, answer, level });
  const result = await geminiModel.generateContent(prompt);
  const text   = result.response.text().trim().replace(/```json|```/g,"");

  let parsed;
  try { parsed = JSON.parse(text); }
  catch { parsed = { technical:0, communication:0, problemSolving:0, confidence:0, clarity:0, practicalKnowledge:0, feedback:"Unparseable model output", redFlags:["parse_error"] }; }

  // Clamp & defaults
  const dims = ["technical","communication","problemSolving","confidence","clarity","practicalKnowledge"];
  for (const d of dims) parsed[d] = Math.max(0, Math.min(10, Number(parsed[d] ?? 0)));
  parsed.redFlags = Array.isArray(parsed.redFlags) ? parsed.redFlags : [];

  // Plug in guardrails — appends to redFlags
  parsed.redFlags = parsed.redFlags.concat(runOutputGuards({ question, answer }));

  return parsed;
}

module.exports.evaluateAnswer = evaluateAnswer;
```

Existing call sites in Module 07 keep working: they read `scores.technical / communication / confidence / problemSolving`. The two new keys (`clarity`, `practicalKnowledge`) are persisted but optional.

---

## 32.4 Persisted score shape

Update `server/models/Interview.js` `questionSchema.scores` (additive only):

```javascript
scores: {
  technical:          { type: Number, default: 0 },
  communication:      { type: Number, default: 0 },
  problemSolving:     { type: Number, default: 0 },
  confidence:         { type: Number, default: 0 },
  clarity:            { type: Number, default: 0 },     // NEW
  practicalKnowledge: { type: Number, default: 0 },     // NEW
  redFlags:           { type: [String], default: [] },  // NEW
  _skipped:           { type: Boolean, default: false }
}
```

---

## 32.5 Aggregate score helpers (used by §34)

```javascript
// server/services/scoreAggregator.js
const W = { technical:0.30, problemSolving:0.20, communication:0.15, clarity:0.10, practicalKnowledge:0.15, confidence:0.10 };

function answerScore(s) {
  if (!s || s._skipped) return 0;
  return (
    s.technical*W.technical + s.problemSolving*W.problemSolving +
    s.communication*W.communication + s.clarity*W.clarity +
    s.practicalKnowledge*W.practicalKnowledge + s.confidence*W.confidence
  ) * 10; // 0..100
}

function roundAverages(questions) {
  const by = { technical:[], resume:[], behavioral:[] };
  for (const q of questions) if (q.scores && !q.scores._skipped) by[q.round]?.push(answerScore(q.scores));
  const avg = (a) => a.length ? Math.round(a.reduce((x,y)=>x+y,0)/a.length) : 0;
  return { technical: avg(by.technical), resume: avg(by.resume), behavioral: avg(by.behavioral) };
}

module.exports = { answerScore, roundAverages, W };
```

> The **existing** final-score formula in `/api/interview/complete` (`ATS*0.2 + Tech*0.4 + Behavioral*0.25 + Comm*0.15`) is **preserved**. `scoreAggregator` is used *additionally* to feed analytics & decision intelligence, not to replace the existing math.

---

## 32.6 Calibration safeguards

* **Lower bound:** if `len(answer) < 15 chars` → cap all dims at 4 (post-model clamp).
* **Off-topic:** if `redFlags` contains `off_topic` → cap `technical` at 3.
* **Memorized:** if `redFlags` contains `memorized` → cap `confidence` at 5, `practicalKnowledge` at 4.

These caps are applied in `evaluateAnswer` *after* the model returns, so the model output can never inflate beyond defensible bounds.
