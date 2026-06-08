# SECTION 34 — Recruiter Decision Intelligence Module

> **Scope:** New service `decisionService.js` that consumes existing artefacts (ATS result, `Interview.questions`, `psychIndicators`, behavioural framework from §33) and produces a **structured hiring brief**. This **augments** — does not replace — the existing `recommendation` field in `Interview` (Module 15).

---

## 34.1 Output shape

```javascript
{
  strengths: [ "React fundamentals", "Project ownership", "Clear communicator" ],
  weaknesses: [ "Weak on system design", "Surface-level Docker knowledge" ],
  missingSkills: [ "Kubernetes", "Redis" ],            // from ATS missingSkills, deduped
  riskFactors: [
    { code: "EXCESSIVE_SKIPS",  detail: "Skipped 3 of 9 questions" },
    { code: "PROMPT_INJECTION", detail: "Attempted to override system prompt" }
  ],
  hiringConfidenceScore: 72,                            // 0..100
  interviewSummary: "3-sentence recruiter-ready summary..."
}
```

Persisted on `Interview` (additive):

```javascript
// server/models/Interview.js
decisionBrief: {
  strengths:               [String],
  weaknesses:              [String],
  missingSkills:           [String],
  riskFactors:             [{ code: String, detail: String }],
  hiringConfidenceScore:   { type: Number, default: 0 },
  interviewSummary:        String,
  generatedAt:             Date,
}
```

---

## 34.2 Confidence score formula

```
HCS =  0.30 × ATS
     + 0.30 × TechnicalRoundAvg
     + 0.20 × BehavioralScore (§33)
     + 0.10 × CommunicationAvg
     + 0.10 × PracticalKnowledgeAvg
     − RiskPenalty
```

`RiskPenalty` = `min(25, riskFactors.length × 8 + skippedCount × 4)`.

```javascript
// server/services/decisionService.js
const { roundAverages, W } = require("./scoreAggregator");
const behavioralWeights    = require("./behavioralWeights");

function calcConfidence({ ats, rounds, behavior, practical, comm, riskCount, skipped }) {
  const base = 0.30*ats + 0.30*rounds.technical + 0.20*behavior + 0.10*comm + 0.10*practical;
  const penalty = Math.min(25, riskCount*8 + skipped*4);
  return Math.max(0, Math.min(100, Math.round(base - penalty)));
}
module.exports.calcConfidence = calcConfidence;
```

---

## 34.3 Strengths / Weaknesses / Summary — Gemini prompt

```javascript
// server/prompts/decision.js
function buildDecisionPrompt({ role, parsedResume, atsResult, interview, behavior }) {
  const qa = interview.questions
    .filter(q => q.answer && !q.scores?._skipped)
    .slice(0, 12) // hard limit
    .map(q => `[${q.round}] ${q.question}\n→ ${q.answer}\nscores=${JSON.stringify(q.scores)}`)
    .join("\n\n");

  return `You are a senior hiring manager writing a recruiter brief for a ${role} candidate.

ATS score: ${atsResult.atsScore}%
Missing skills: ${atsResult.missingSkills?.join(", ") || "none"}
Behavioural profile: ${JSON.stringify(behavior || {})}

Interview Q&A (truncated):
${qa}

Return ONLY valid JSON with this exact shape, no markdown:
{
  "strengths":         [ "3 to 5 concise bullets" ],
  "weaknesses":        [ "2 to 4 concise bullets" ],
  "interviewSummary":  "3-sentence recruiter-ready summary"
}

Rules:
- Use ONLY evidence from the Q&A above.
- Do NOT invent technologies the candidate did not mention.
- Strengths must be specific (e.g. "Built REST APIs with Express + JWT") not generic.
- Weaknesses must be actionable (e.g. "Confused server-side rendering with hydration").`;
}
module.exports = { buildDecisionPrompt };
```

---

## 34.4 Risk Factor detection

```javascript
// server/services/riskDetector.js
function detectRisks(interview) {
  const risks = [];
  const qs = interview.questions || [];
  const skipped = qs.filter(q => q.scores?._skipped).length;
  if (skipped > 2) risks.push({ code:"EXCESSIVE_SKIPS", detail:`Skipped ${skipped} of ${qs.length} questions` });

  const flagged = qs.flatMap(q => q.scores?.redFlags || []);
  if (flagged.includes("prompt_injection")) risks.push({ code:"PROMPT_INJECTION", detail:"Attempted to override system prompt" });
  if (flagged.filter(f=>f==="paste_detected").length > 1) risks.push({ code:"COPY_PASTE_PATTERN", detail:"Multiple answers show paste pattern" });
  if (flagged.filter(f=>f==="too_short").length >= 3)    risks.push({ code:"TOO_SHORT_PATTERN", detail:"Multiple answers were trivially short" });
  if (flagged.includes("offensive"))                     risks.push({ code:"OFFENSIVE_CONTENT", detail:"Answer contained offensive language" });
  if (flagged.includes("ai_generated"))                  risks.push({ code:"AI_ASSISTED_ANSWERS", detail:"High likelihood of AI-written answers" });
  return { risks, skipped };
}
module.exports = { detectRisks };
```

---

## 34.5 Orchestrator

```javascript
// server/services/decisionService.js
const { geminiModel } = require("../config/gemini");
const { buildDecisionPrompt } = require("../prompts/decision");
const { roundAverages } = require("./scoreAggregator");
const { score: behaviorScore } = require("./behavioralWeights");
const { detectRisks } = require("./riskDetector");
const { calcConfidence } = require("./decisionService_calc"); // tiny helper file or inline

async function buildBrief({ candidate, interview }) {
  const atsResult = { atsScore: candidate.atsScore, missingSkills: candidate.missingSkills };
  const behavior  = interview.psychIndicators?.behavioral;
  const rounds    = roundAverages(interview.questions);

  // 1) Gemini-driven narrative
  const prompt = buildDecisionPrompt({ role: candidate.selectedRole, parsedResume: candidate.parsedResume, atsResult, interview, behavior });
  const raw    = (await geminiModel.generateContent(prompt)).response.text().trim().replace(/```json|```/g,"");
  let narrative;
  try { narrative = JSON.parse(raw); }
  catch { narrative = { strengths:[], weaknesses:[], interviewSummary:"" }; }

  // 2) Deterministic risk + score
  const { risks, skipped } = detectRisks(interview);
  const practicalAvg = avg(interview.questions, "practicalKnowledge");
  const commAvg      = avg(interview.questions, "communication");
  const behavior100  = behaviorScore(behavior);
  const hcs = calcConfidence({
    ats: candidate.atsScore || 0,
    rounds, behavior: behavior100, practical: practicalAvg, comm: commAvg,
    riskCount: risks.length, skipped
  });

  return {
    strengths:   narrative.strengths   || [],
    weaknesses:  narrative.weaknesses  || [],
    missingSkills: candidate.missingSkills || [],
    riskFactors: risks,
    hiringConfidenceScore: hcs,
    interviewSummary: narrative.interviewSummary || "",
    generatedAt: new Date()
  };
}

function avg(qs, key) {
  const v = qs.map(q => q.scores?.[key]).filter(x => typeof x === "number" && !isNaN(x));
  return v.length ? Math.round((v.reduce((a,b)=>a+b,0)/v.length) * 10) : 0;
}

module.exports = { buildBrief };
```

```javascript
// server/services/decisionService_calc.js
const { calcConfidence } = require("./decisionService");
module.exports = { calcConfidence };
```

---

## 34.6 Wire into `/api/interview/complete`

```javascript
// AFTER existing finalScore + recommendation assignment, BEFORE interview.save()
const brief = await require("../services/decisionService").buildBrief({ candidate, interview });
interview.decisionBrief = brief;

// Use HCS to override only when extreme — keeps the existing 3-band rule intact
if (brief.riskFactors.some(r => ["PROMPT_INJECTION","OFFENSIVE_CONTENT","AI_ASSISTED_ANSWERS"].includes(r.code))) {
  interview.recommendation = "Needs Improvement";
}
```

---

## 34.7 HR Dashboard exposure

```javascript
// server/routes/hr.js  — APPEND
router.get("/brief/:interviewId", auth, hrOnly, async (req,res) => {
  const iv = await Interview.findById(req.params.interviewId)
    .select("decisionBrief finalScores recommendation selectedRole psychIndicators candidateId")
    .populate({ path:"candidateId", populate:{ path:"userId", select:"name email" } });
  if (!iv) return res.status(404).json({ message:"Not found" });
  res.json(iv);
});
```

The PDF report (Module 16) is extended with a "Recruiter Brief" page that prints `strengths`, `weaknesses`, `riskFactors`, `hiringConfidenceScore`, and `interviewSummary`.
