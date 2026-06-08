# SECTION 31 — Advanced Question Generation Engine

> **Scope:** Extends the existing `generateQuestions(...)` in `server/services/geminiService.js` (Module 07) with strategy selection, anti-repetition, dynamic difficulty, follow-ups, and skip handling. The original function signature is preserved as a **facade** so Module 07 code keeps working.

---

## 31.1 Architecture

```
   ┌───────────────────────────────────────────────────────────────┐
   │                  questionEngine.generate()                    │
   │                                                               │
   │  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐ │
   │  │ Resume-     │   │ Role-       │   │ Missing-Skill       │ │
   │  │ based       │   │ based       │   │ (gap targeted)      │ │
   │  └─────────────┘   └─────────────┘   └─────────────────────┘ │
   │            │              │                  │                │
   │            └──────┬───────┴──────────────────┘                │
   │                   ▼                                           │
   │           [ Difficulty Tuner ]  ◄── prior answer scores       │
   │                   ▼                                           │
   │           [ Anti-Repetition ]  ◄── hash cache (Redis/Mongo)   │
   │                   ▼                                           │
   │           [ Gemini 2.5 Flash ]                                │
   │                   ▼                                           │
   │           [ Output Validator ]                                │
   └───────────────────────────────────────────────────────────────┘
```

---

## 31.2 Strategy modules

```javascript
// server/services/questionStrategies.js
function resumeBased({ parsedResume }) {
  const projects = (parsedResume.projects || []).slice(0,3).join(" | ");
  return `Focus on the candidate's own projects and experience: "${projects}".
Probe depth: ask HOW they built it, what trade-offs they made, and what they would change.`;
}

function roleBased({ role }) {
  return `Focus on canonical ${role} fundamentals, system design, and best practices that any senior ${role} should answer fluently.`;
}

function missingSkill({ missingSkills }) {
  if (!missingSkills?.length) return null;
  return `The candidate is MISSING these skills: ${missingSkills.join(", ")}.
Ask ONE conceptual question per missing skill to assess if they can learn it quickly.
Avoid trivia; assess reasoning.`;
}

module.exports = { resumeBased, roleBased, missingSkill };
```

---

## 31.3 Dynamic Difficulty Adjustment

```javascript
// server/services/difficultyTuner.js
// Maps last-3 answer scores → next-question difficulty.
const LEVELS = ["easy", "medium", "hard", "expert"];

function nextLevel(prevScores = []) {
  if (!prevScores.length) return "medium";
  const last = prevScores.slice(-3);
  const avg  = last.reduce((a,b)=>a+b,0) / last.length;     // 0..10
  if (avg >= 8.5) return "expert";
  if (avg >= 7.0) return "hard";
  if (avg >= 5.0) return "medium";
  return "easy";
}

function difficultyHint(level) {
  return {
    easy:    "Use plain, foundational questions a junior dev should know.",
    medium:  "Use practical scenario questions a mid-level dev should answer.",
    hard:    "Use multi-step reasoning, design trade-offs, edge cases.",
    expert:  "Use senior-level system design, optimisation, and failure-mode questions."
  }[level];
}

module.exports = { nextLevel, difficultyHint, LEVELS };
```

---

## 31.4 Anti-Repetition Logic

A normalized hash of every question asked to a given candidate is cached. Future generations are post-filtered against this set; up to **3 retries** ask Gemini to regenerate excluded items.

```javascript
// server/services/antiRepeat.js
const crypto = require("crypto");
const redis  = require("../config/redis");

const norm = (q) => q.toLowerCase().replace(/[^a-z0-9 ]/g,"").replace(/\s+/g," ").trim();
const hash = (q) => crypto.createHash("sha1").update(norm(q)).digest("hex").slice(0,16);
const KEY  = (uid) => `iv:askedQs:${uid}`;

async function addAsked(userId, qs) {
  if (!redis) return;
  await redis.sadd(KEY(userId), ...qs.map(hash));
  await redis.expire(KEY(userId), 60*60*24*60); // 60 days
}

async function filterFresh(userId, qs) {
  if (!redis) return qs;
  const set = new Set(await redis.smembers(KEY(userId)));
  return qs.filter(q => !set.has(hash(q)));
}

module.exports = { addAsked, filterFresh };
```

---

## 31.5 Follow-up Questions

After every answer, if `confidence + problemSolving < 12` (out of 20), a single follow-up is generated *inline* — this drills the candidate without expanding the global question count.

```javascript
// server/services/followUpGenerator.js
const { geminiModel } = require("../config/gemini");

async function generateFollowUp({ role, question, answer, scores }) {
  const weak = scores.confidence + scores.problemSolving < 12;
  if (!weak) return null;

  const prompt = `You are a ${role} interviewer.
Original question: "${question}"
Candidate's answer: "${answer}"

The answer was weak in confidence/reasoning. Ask ONE short follow-up to clarify the candidate's actual depth.
Return ONLY the question text (no JSON, no quotes).`;
  const r = await geminiModel.generateContent(prompt);
  return r.response.text().trim().replace(/^"|"$/g,"");
}

module.exports = { generateFollowUp };
```

Stored as a question with `round = "<originalRound>"` and `meta.followUpOf = <index>`.

---

## 31.6 Skip Handling

Candidates may legitimately skip a question. Skips are stored, do **not** zero-out scores, but do mark a flag used by §34 decision intelligence.

```javascript
// server/routes/interview.js
router.post("/skip", auth, async (req,res) => {
  const { interviewId, questionIndex, reason } = req.body;
  const iv = await Interview.findById(interviewId);
  if (!iv) return res.status(404).json({ message:"Not found" });

  iv.questions[questionIndex].answer = "[SKIPPED]";
  iv.questions[questionIndex].scores = { technical:0, communication:0, confidence:0, problemSolving:0, _skipped:true };
  iv.questions[questionIndex].meta   = { ...(iv.questions[questionIndex].meta||{}), skipReason: reason || "no_reason" };
  iv.markModified("questions");
  await iv.save();
  res.json({ ok:true });
});
```

Skip cap rule (enforced in `/complete`):

```javascript
const skipped = interview.questions.filter(q => q.scores?._skipped).length;
if (skipped > 2) interview.flags.push("EXCESSIVE_SKIPS");   // §34 risk factor
```

---

## 31.7 Unified `questionEngine.generate()` (facade)

```javascript
// server/services/questionEngine.js
const { geminiModel } = require("../config/gemini");
const { resumeBased, roleBased, missingSkill } = require("./questionStrategies");
const { nextLevel, difficultyHint } = require("./difficultyTuner");
const { filterFresh, addAsked } = require("./antiRepeat");

function buildPrompt({ role, parsedResume, atsResult, round, level }) {
  const strategies = [
    round === "resume" && resumeBased({ parsedResume }),
    round === "technical" && roleBased({ role }),
    round === "technical" && missingSkill({ missingSkills: atsResult.missingSkills }),
    round === "behavioral" && "Use STAR-format prompts about teamwork, conflict, accountability and adaptability."
  ].filter(Boolean);

  return `You are a senior ${role} interviewer.

Candidate skills: ${parsedResume.skills?.join(", ") || "n/a"}
Candidate projects: ${(parsedResume.projects||[]).slice(0,3).join(" | ")}
Missing skills: ${atsResult.missingSkills?.join(", ") || "none"}

Strategy for THIS round (${round}):
${strategies.map(s => "• " + s).join("\n")}

Difficulty: ${level}. ${difficultyHint(level)}

Produce 3 distinct interview questions. Return ONLY a JSON array of strings, no markdown.`;
}

async function generate({ role, parsedResume, atsResult, round, userId, priorScores }) {
  const level = nextLevel(priorScores);
  const prompt = buildPrompt({ role, parsedResume, atsResult, round, level });

  // up to 3 attempts to avoid repeats
  for (let attempt=0; attempt<3; attempt++) {
    const out = await geminiModel.generateContent(prompt);
    const text = out.response.text().trim().replace(/```json|```/g,"");
    let qs = [];
    try { qs = JSON.parse(text); } catch { qs = []; }
    qs = qs.filter(q => typeof q === "string" && q.length > 10);

    const fresh = await filterFresh(userId, qs);
    if (fresh.length >= 3) {
      await addAsked(userId, fresh.slice(0,3));
      return fresh.slice(0,3);
    }
  }
  // fallback: return whatever we got even if duplicates
  return ["Tell me about a recent project you built.",
          "What is the trickiest bug you have debugged?",
          "How do you decide between two competing solutions?"];
}

// Backwards-compatible facade (Module 07 callers untouched)
async function generateQuestions(role, parsedResume, atsResult, round="technical") {
  return generate({ role, parsedResume, atsResult, round, userId: parsedResume._uid || "anon", priorScores: [] });
}

module.exports = { generate, generateQuestions };
```

Then change the import in `geminiService.js` to re-export:

```javascript
// server/services/geminiService.js — replace ONLY the generateQuestions impl
const { generateQuestions } = require("./questionEngine");
```

All other Module 07 calls remain valid.
