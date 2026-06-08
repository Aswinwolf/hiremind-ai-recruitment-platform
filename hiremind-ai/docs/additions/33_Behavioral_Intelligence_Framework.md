# SECTION 33 — Behavioral Intelligence Framework

> **Scope:** Adds a structured 7-trait behavioral analysis layer that consumes the **already-recorded** behavioral-round answers (Module 07, round = `"behavioral"`) and persists them on the existing `Interview.psychIndicators` subdocument. **No schema renames** — only additive sub-fields.

---

## 33.1 Traits

| Trait                  | Key                | Levels                                |
| :--------------------- | :----------------- | :------------------------------------ |
| Teamwork               | `teamwork`         | Strong / Adequate / Weak              |
| Leadership             | `leadership`       | Demonstrated / Emerging / Not Shown   |
| Adaptability           | `adaptability`     | High / Medium / Low                   |
| Accountability         | `accountability`   | High / Medium / Low                   |
| Conflict Resolution    | `conflictResolution` | Mature / Reactive / Avoidant        |
| Learning Mindset       | `learningMindset`  | Growth / Fixed / Mixed                |
| Decision Making        | `decisionMaking`   | Data-driven / Intuitive / Hesitant    |

---

## 33.2 Additive schema

```javascript
// server/models/Interview.js  — APPEND inside psychIndicators
behavioral: {
  teamwork:           String,
  leadership:         String,
  adaptability:       String,
  accountability:     String,
  conflictResolution: String,
  learningMindset:    String,
  decisionMaking:     String,
  evidence: {
    teamwork:           String,
    leadership:         String,
    adaptability:       String,
    accountability:     String,
    conflictResolution: String,
    learningMindset:    String,
    decisionMaking:     String,
  },
  overallBehaviorScore: { type: Number, default: 0 }  // 0..100
}
```

---

## 33.3 Production prompt

```javascript
// server/prompts/behavioral.js
function buildBehavioralPrompt(behavioralAnswers) {
  const block = behavioralAnswers.map((a,i)=>`Q${i+1}: ${a.question}\nA${i+1}: ${a.answer}`).join("\n\n");

  return `You are an occupational psychologist analysing behavioural interview answers.

Answers:
${block}

For EACH of these 7 traits, output:
1. a level from the allowed values
2. a one-sentence EVIDENCE quote (paraphrase) from the candidate's answers

Allowed values:
- teamwork:           "Strong" | "Adequate" | "Weak"
- leadership:         "Demonstrated" | "Emerging" | "Not Shown"
- adaptability:       "High" | "Medium" | "Low"
- accountability:     "High" | "Medium" | "Low"
- conflictResolution: "Mature" | "Reactive" | "Avoidant"
- learningMindset:    "Growth" | "Fixed" | "Mixed"
- decisionMaking:     "Data-driven" | "Intuitive" | "Hesitant"

Also output an overallBehaviorScore (0-100, integer).

Return ONLY valid JSON, no markdown:

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
module.exports = { buildBehavioralPrompt };
```

---

## 33.4 Service

```javascript
// server/services/behavioralService.js
const { geminiModel } = require("../config/gemini");
const { buildBehavioralPrompt } = require("../prompts/behavioral");

async function analyzeBehavior(behavioralAnswers) {
  if (!behavioralAnswers?.length) return null;
  const prompt = buildBehavioralPrompt(behavioralAnswers);
  const r = await geminiModel.generateContent(prompt);
  const text = r.response.text().trim().replace(/```json|```/g,"");

  let p;
  try { p = JSON.parse(text); }
  catch { return { overallBehaviorScore: 0, _parseError:true }; }

  const keys = ["teamwork","leadership","adaptability","accountability","conflictResolution","learningMindset","decisionMaking"];
  const out  = { evidence: {}, overallBehaviorScore: Math.max(0, Math.min(100, Number(p.overallBehaviorScore||0))) };
  for (const k of keys) {
    out[k] = p[k]?.level || null;
    out.evidence[k] = p[k]?.evidence || null;
  }
  return out;
}

module.exports = { analyzeBehavior };
```

---

## 33.5 Wiring into `/api/interview/complete`

```javascript
// server/routes/interview.js  — inside POST /complete, AFTER analyzePsychIndicators(...)
const behavioralAnswers = interview.questions.filter(q => q.round === "behavioral" && q.answer && !q.scores?._skipped);
const behavioral = await analyzeBehavior(behavioralAnswers);
if (behavioral) interview.psychIndicators.behavioral = behavioral;
interview.markModified("psychIndicators");
```

The existing `psychIndicators` short summary (Module 09) is **kept**; this just adds the structured `behavioral` sub-object.

---

## 33.6 Mapping to recommendation (used by §34)

```javascript
// server/services/behavioralWeights.js
const POS = {
  teamwork:{Strong:1,Adequate:0.6,Weak:0.2},
  leadership:{Demonstrated:1,Emerging:0.6,"Not Shown":0.2},
  adaptability:{High:1,Medium:0.6,Low:0.2},
  accountability:{High:1,Medium:0.6,Low:0.2},
  conflictResolution:{Mature:1,Reactive:0.5,Avoidant:0.2},
  learningMindset:{Growth:1,Mixed:0.6,Fixed:0.3},
  decisionMaking:{"Data-driven":1,Intuitive:0.6,Hesitant:0.3}
};
function score(b) {
  if (!b) return 0;
  const keys = Object.keys(POS);
  const sum = keys.reduce((s,k)=> s + (POS[k][b[k]] ?? 0.5), 0);
  return Math.round((sum / keys.length) * 100);
}
module.exports = { score };
```

> This score feeds §34's Hiring Confidence Score. It is **not** used to replace the existing `behavioralScore` in `interview.finalScores`.

---

## 33.7 Surface in the PDF report (Module 16)

Append to the existing "Workplace Indicators" block (no removal):

```javascript
if (interview.psychIndicators?.behavioral) {
  const b = interview.psychIndicators.behavioral;
  doc.moveDown(0.3).fontSize(11).font("Helvetica-Bold").fillColor("#0D1B2A").text("Behavioural Intelligence");
  doc.fontSize(10).font("Helvetica").fillColor("#212121");
  [
    ["Teamwork", b.teamwork],
    ["Leadership", b.leadership],
    ["Adaptability", b.adaptability],
    ["Accountability", b.accountability],
    ["Conflict Resolution", b.conflictResolution],
    ["Learning Mindset", b.learningMindset],
    ["Decision Making", b.decisionMaking],
  ].forEach(([k,v]) => doc.text(`${k}: ${v||"-"}`));
  doc.moveDown(0.3).fillColor("#555").fontSize(9).text(`Overall behavioural score: ${b.overallBehaviorScore}/100`);
}
```
