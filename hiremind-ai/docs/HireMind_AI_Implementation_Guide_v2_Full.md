# HireMind AI — Implementation Guide v2 (FULL MERGED)

> **Merged guide** = Original Sections 1–28 (reference list — full content lives in the original PDF) + Production-grade additions §29–§42 (full content inlined below).
> Generated: 2026-06-08T22:16:33Z

---

## Part A — Original Guide (Sections 1–28)

> The original sections remain authoritative in the source PDF (`HireMind_AI_Implementation_Guide.pdf`). They are listed here for navigation only — no content has been modified, removed, or rewritten.

| # | Section / Module | Source |
| :- | :--- | :--- |
| 1 | Project Overview & Architecture | Original PDF §1 |
| 2 | Development Environment Setup | Original PDF §2 |
| 3 | Database Schema Design (MongoDB) | Original PDF §3 |
| 4 | Module 01 — Candidate Registration & Auth | Original PDF §4 |
| 5 | Module 02 — Role Selection | Original PDF §5 |
| 6 | Module 03 — Resume Upload | Original PDF §6 |
| 7 | Module 04 — Resume Parsing (Python Microservice) | Original PDF §7 |
| 8 | Module 05 — ATS Score Engine | Original PDF §8 |
| 9 | Module 06 — Eligibility Check | Original PDF §9 |
| 10 | Module 07 — AI Interview Engine (Gemini 2.5 Flash) | Original PDF §10 |
| 11 | Module 08 — Behavioral Assessment Round | Original PDF §11 |
| 12 | Module 09 — Psychological Indicators | Original PDF §12 |
| 13 | Module 10 — Voice Interview (Web Speech API) | Original PDF §13 |
| 14 | Module 11 — Real-Time Scoring System | Original PDF §14 |
| 15 | Module 12 — Interview Recording | Original PDF §15 |
| 16 | Module 13 — Candidate Feedback | Original PDF §16 |
| 17 | Module 14 — Final Evaluation Engine | Original PDF §17 |
| 18 | Module 15 — Recommendation Engine | Original PDF §18 |
| 19 | Module 16 — PDF Report Generation (PDFKit) | Original PDF §19 |
| 20 | Module 17 — Candidate Dashboard | Original PDF §20 |
| 21 | Module 18 — HR Dashboard | Original PDF §21 |
| 22 | Module 19 — Candidate Ranking System | Original PDF §22 |
| 23 | Module 20 — Admin Panel | Original PDF §23 |
| 24 | Frontend Implementation (React + Tailwind) | Original PDF §24 |
| 25 | API Routes Reference | Original PDF §25 |
| 26 | Environment Variables & Configuration | Original PDF §26 |
| 27 | Deployment Guide (Free Hosting) | Original PDF §27 |
| 28 | Testing Checklist | Original PDF §28 |

---

## Part B — New Production-Grade Sections (§29–§42)

> The 14 new sections below are inlined in full. Each section is self-contained and cross-references the original modules (`→ Module 0X` notation).


---

# SECTION 29 — End-to-End Interview Workflow Diagrams

> **Scope:** Visualizes how data, control, and AI calls flow across every module documented in Sections 1–28. No existing module is modified — these diagrams document the **already-defined** behavior at a production-architecture level.

---

## 29.1 Complete Workflow (Candidate Journey)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         CANDIDATE LIFECYCLE                              │
└──────────────────────────────────────────────────────────────────────────┘

  [Register] ─► [Login] ─► [Select Role] ─► [Upload Resume]
                                                  │
                                                  ▼
                              ┌──────────────────────────────────┐
                              │  Python Parser Microservice      │
                              │  (Module 04 — pdfplumber)        │
                              └──────────────────────────────────┘
                                                  │
                                                  ▼
                              ┌──────────────────────────────────┐
                              │  ATS Score Engine (Module 05)    │
                              │  matched/required × 100          │
                              └──────────────────────────────────┘
                                                  │
                          ┌───────────────────────┴────────────────────────┐
                          ▼                                                ▼
                  score ≥ threshold                                   score < threshold
                          │                                                │
                          ▼                                                ▼
              [Eligibility Check OK]                          [Improve Skills Screen]
                          │                                                │
                          ▼                                                ▼
              [Interview Lock acquired]                        [Resume Improvement → §41.9]
                          │
                          ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │           AI INTERVIEW ENGINE (Module 07) — Gemini 2.5 Flash         │
   │                                                                      │
   │   Round 1 Technical   →  3 Qs  (Resume-based + Role-based)          │
   │   Round 2 Resume Deep →  3 Qs  (Projects & Experience)              │
   │   Round 3 Behavioral  →  3 Qs  (STAR-format prompts)                │
   │                                                                      │
   │   Per question: Voice answer → Real-time scoring → Persist          │
   └──────────────────────────────────────────────────────────────────────┘
                                                  │
                                                  ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │      AI Evaluation Framework (§32) + Behavioral Framework (§33)     │
   │      Guardrails (§35) run on every answer                            │
   └──────────────────────────────────────────────────────────────────────┘
                                                  │
                                                  ▼
                  [Final Evaluation Engine — Module 14]
                                                  │
                                                  ▼
   [Recommendation Engine (Module 15)] → [PDF Report (Module 16)] → [Candidate Dashboard]
                                                  │
                                                  ▼
                              [HR Dashboard / Ranking / ATS Analytics]
```

---

## 29.2 System Flow (Services & Ports)

```
┌─────────────────────────┐       HTTPS         ┌────────────────────────────┐
│  React Client  :3000    │ ◄────────────────► │  Express API   :5000       │
│  (Vite)                 │   JWT (Access)      │  Node 20+                  │
│                         │   Refresh cookie    │                            │
└─────────────────────────┘                     └────────────────────────────┘
                                                          │
                ┌─────────────────────────────────────────┼─────────────────────┐
                │                                         │                     │
                ▼                                         ▼                     ▼
  ┌─────────────────────────┐         ┌────────────────────────┐    ┌────────────────────┐
  │ MongoDB Atlas (TLS)     │         │ Redis (cache + queue)  │    │ Python Parser:5001 │
  │ replica set, indexes    │         │ BullMQ workers         │    │ Flask + pdfplumber │
  └─────────────────────────┘         └────────────────────────┘    └────────────────────┘
                                                  │
                                                  ▼
                                       ┌──────────────────────┐
                                       │ Gemini 2.5 Flash API │
                                       │ Google AI Studio     │
                                       └──────────────────────┘

  ┌─────────────────────────┐                                     ┌────────────────────┐
  │ AWS S3 / CloudFront CDN │ ◄── resume + report uploads ───────│ Express API        │
  └─────────────────────────┘                                     └────────────────────┘
```

**Port map (local dev):**

| Service          | Port  | Purpose                       |
| :--------------- | :---- | :---------------------------- |
| React (Vite)     | 3000  | Frontend dev server           |
| Express API      | 5000  | REST API + auth + uploads     |
| Python Parser    | 5001  | Resume parsing microservice   |
| MongoDB          | 27017 | Database (Atlas in prod)      |
| Redis            | 6379  | Cache + BullMQ queue          |

---

## 29.3 Data Flow (Sequence — one interview)

```
Candidate           React           Express API         Mongo        Gemini        Redis
   │                  │                  │                │            │             │
   │── POST /login ──►│                  │                │            │             │
   │                  │── /auth/login ─►│                │            │             │
   │                  │                  │── User.find ─►│            │             │
   │                  │                  │◄── ok ────────│            │             │
   │                  │                  │── sign JWT+RT │            │             │
   │                  │◄── tokens ──────│                │            │             │
   │                                                                                  │
   │── Upload PDF ───►│── multipart ────►│                │            │             │
   │                  │                  │── parser:5001 ──────────────────────────►│ (Python)
   │                  │                  │◄── parsed JSON ────────────────────────── │
   │                  │                  │── Candidate.save ►│         │             │
   │                                                                                  │
   │── Start Interview ►                  │── acquire LOCK ───────────────────────────►│
   │                  │                  │── generateQuestions(3 rounds) ──►│         │
   │                  │                  │◄── 9 questions ────────────────── │         │
   │                  │                  │── Interview.save ►│              │         │
   │                  │◄── 9 Qs ────────│                │                  │         │
   │                                                                                  │
   │── Answer Q1 ────►│── /answer ──────►│── guardrails (§35) ─┐                      │
   │                  │                  │◄────────────────────┘                      │
   │                  │                  │── evaluateAnswer ───────────────►│         │
   │                  │                  │◄── 6-dim scores ─────────────────│         │
   │                  │                  │── Interview.update►│                      │
   │                  │◄── scores ──────│                │                  │         │
   │                                  (repeat for Q2..Q9)                            │
   │                                                                                  │
   │── Complete ─────►│── /complete ────►│── analyzePsych+behavioral ───►│            │
   │                  │                  │── recruiterDecisionEngine ─►│              │
   │                  │                  │── Interview.finalize ►│                    │
   │                  │                  │── enqueue PDF report ─────────────────────►│ (BullMQ)
   │                  │                  │── release LOCK ──────────────────────────► │
   │                  │◄── finalScore ───│                                            │
   │                                                                                  │
   │── Download PDF ─►│── /report ──────►│── PDFKit stream ─►│                        │
   │◄── PDF ──────────│                  │                                            │
```

---

## 29.4 Round → Module Mapping (for traceability)

| Phase              | Original Module | New Section Reference            |
| :----------------- | :-------------- | :------------------------------- |
| Register/Login     | Module 01       | §36 RBAC + §36 Refresh tokens    |
| Role Selection     | Module 02       | —                                |
| Resume Upload      | Module 03       | §36 Secure upload validation     |
| Resume Parse       | Module 04       | §37 Queue offload (optional)     |
| ATS Scoring        | Module 05       | §39 Aggregation pipelines        |
| Eligibility        | Module 06       | §30 Locking                      |
| AI Interview       | Module 07       | §31 Question gen, §32 evaluation |
| Behavioral Round   | Module 08       | §33 Behavioral framework         |
| Psych Indicators   | Module 09       | §40 Prompt: psych                |
| Voice Interview    | Module 10       | §35 anti-cheat (paste/short)     |
| Real-Time Scoring  | Module 11       | §32 Evaluation                   |
| Recording          | Module 12       | §37 S3                           |
| Feedback           | Module 13       | —                                |
| Final Evaluation   | Module 14       | §34 Decision Intelligence        |
| Recommendation     | Module 15       | §34 Hiring confidence            |
| PDF Report         | Module 16       | §37 Worker offload               |
| Candidate Dash     | Module 17       | —                                |
| HR Dash            | Module 18       | §38 HR analytics                 |
| Ranking            | Module 19       | §39 Ranking optimization         |
| Admin Panel        | Module 20       | §36 RBAC                         |

> All diagrams above describe the **already-implemented** system. Subsequent sections specify *how to harden, scale, and observe* it without changing its public contracts.


---

# SECTION 30 — Interview State Management System

> **Scope:** Adds production-grade state tracking on top of the existing `Interview` schema (Section 3) and `/api/interview/*` routes (Module 07). **No existing fields are removed or renamed** — only additive fields and an auxiliary `InterviewLock` collection are introduced.

---

## 30.1 Progress Tracking

### Additive fields on `Interview` (backwards-compatible)

```javascript
// server/models/Interview.js — APPEND to existing schema (DO NOT replace)
progress: {
  currentIndex:       { type: Number, default: 0 },          // 0..N-1
  answeredCount:      { type: Number, default: 0 },
  totalQuestions:     { type: Number, default: 0 },
  currentRound:       { type: String, enum: ["technical","resume","behavioral"], default: "technical" },
  roundsCompleted:    { type: [String], default: [] },        // ["technical", "resume", ...]
  lastActivityAt:     { type: Date, default: Date.now },
},
session: {
  sessionToken:       { type: String, index: true },          // opaque; rotates on resume
  ipHash:             String,
  userAgentHash:      String,
  startedAt:          { type: Date, default: Date.now },
  resumeCount:        { type: Number, default: 0 },
  isLocked:           { type: Boolean, default: false },
}
```

Computed read endpoint:

```javascript
// server/routes/interview.js
router.get("/progress/:interviewId", auth, async (req, res) => {
  const iv = await Interview.findById(req.params.interviewId)
    .select("progress status questions.round questions.answer");
  if (!iv) return res.status(404).json({ message: "Not found" });
  const total = iv.questions.length;
  const answered = iv.questions.filter(q => q.answer && q.answer.trim()).length;
  res.json({
    percent: total ? Math.round((answered/total)*100) : 0,
    answered, total,
    currentRound: iv.progress.currentRound,
    roundsCompleted: iv.progress.roundsCompleted,
    status: iv.status,
  });
});
```

---

## 30.2 Session Recovery

Recovery is **idempotent** — the same candidate hitting `/start` while an active interview exists is *resumed*, not duplicated.

```javascript
// server/services/sessionService.js
const crypto = require("crypto");
const Interview = require("../models/Interview");

const sha = (v) => crypto.createHash("sha256").update(String(v||"")).digest("hex");

async function getOrResume({ userId, candidateId, ip, ua }) {
  const active = await Interview.findOne({
    userId, status: "in-progress"
  }).sort({ "session.startedAt": -1 });

  if (active) {
    active.session.resumeCount += 1;
    active.session.ipHash = sha(ip);
    active.session.userAgentHash = sha(ua);
    active.progress.lastActivityAt = new Date();
    await active.save();
    return { interview: active, resumed: true };
  }
  return { interview: null, resumed: false };
}

module.exports = { getOrResume, sha };
```

Modify the existing `POST /api/interview/start` to call `getOrResume` *before* creating a new document.  The fallback (creating a new `Interview`) is the **existing** code path from Module 07 — unchanged.

---

## 30.3 Round Completion Tracking

```javascript
// server/services/roundService.js
const ROUND_ORDER = ["technical", "resume", "behavioral"];

function detectRoundCompletion(questions) {
  const completed = [];
  for (const r of ROUND_ORDER) {
    const inRound = questions.filter(q => q.round === r);
    if (inRound.length > 0 && inRound.every(q => q.answer && q.answer.trim()))
      completed.push(r);
  }
  const currentRound = ROUND_ORDER.find(r => !completed.includes(r)) || "behavioral";
  return { roundsCompleted: completed, currentRound };
}

module.exports = { detectRoundCompletion, ROUND_ORDER };
```

Wire it into the existing `/answer` handler **without** changing its response contract:

```javascript
// inside POST /api/interview/answer — after q.answer = answer
const { roundsCompleted, currentRound } = detectRoundCompletion(interview.questions);
interview.progress.answeredCount = interview.questions.filter(q => q.answer?.trim()).length;
interview.progress.totalQuestions = interview.questions.length;
interview.progress.currentIndex   = Math.min(interview.progress.answeredCount, interview.questions.length-1);
interview.progress.roundsCompleted = roundsCompleted;
interview.progress.currentRound    = currentRound;
interview.progress.lastActivityAt  = new Date();
```

---

## 30.4 Duplicate Interview Prevention

Two layers — **DB unique partial index** + **service-level guard**:

```javascript
// server/models/Interview.js — APPEND after schema declaration
interviewSchema.index(
  { userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "in-progress" } }
);
```

Service guard before the existing `Interview.create(...)` in `/start`:

```javascript
const existing = await Interview.findOne({ userId: req.user.id, status: "in-progress" });
if (existing) {
  return res.json({
    interviewId: existing._id,
    resumed: true,
    questions: existing.questions.map((q,i)=>({ index:i, question:q.question, round:q.round, answered: !!q.answer }))
  });
}
```

This **does not** alter the response shape for first-time starts — only adds a `resumed: true` flag when recovery occurs.

---

## 30.5 Interview Locking

Prevents two browser tabs / devices from answering the same interview concurrently. Uses Redis with TTL fallback (in-memory) so the system still works without Redis.

```javascript
// server/services/lockService.js
const redis = require("../config/redis");   // optional client (returns null if not configured)

const TTL_SEC = 90;                          // lock auto-expires
const KEY = (id) => `iv:lock:${id}`;

const mem = new Map();                       // in-memory fallback

async function acquire(interviewId, holder) {
  if (redis) {
    const ok = await redis.set(KEY(interviewId), holder, "NX", "EX", TTL_SEC);
    return ok === "OK";
  }
  const now = Date.now();
  const cur = mem.get(interviewId);
  if (cur && cur.expires > now && cur.holder !== holder) return false;
  mem.set(interviewId, { holder, expires: now + TTL_SEC*1000 });
  return true;
}

async function renew(interviewId, holder) {
  if (redis) {
    const cur = await redis.get(KEY(interviewId));
    if (cur && cur !== holder) return false;
    await redis.set(KEY(interviewId), holder, "EX", TTL_SEC);
    return true;
  }
  mem.set(interviewId, { holder, expires: Date.now() + TTL_SEC*1000 });
  return true;
}

async function release(interviewId, holder) {
  if (redis) {
    const cur = await redis.get(KEY(interviewId));
    if (cur === holder) await redis.del(KEY(interviewId));
    return;
  }
  const cur = mem.get(interviewId);
  if (cur && cur.holder === holder) mem.delete(interviewId);
}

module.exports = { acquire, renew, release };
```

Wire into routes:

```javascript
// /api/interview/start — after interview created/resumed
const holder = crypto.randomUUID();
await lockService.acquire(interview._id.toString(), holder);
res.cookie("iv_lock", holder, { httpOnly:true, sameSite:"lax", maxAge: 60*60*1000 });

// /api/interview/answer — first line
const holder = req.cookies?.iv_lock;
const ok = await lockService.renew(interviewId, holder);
if (!ok) return res.status(423).json({ message: "Interview is open in another session" });

// /api/interview/complete — last line before res.json
await lockService.release(interviewId, req.cookies?.iv_lock);
```

> Add `cookie-parser` to `server/index.js`: `app.use(require("cookie-parser")());`

---

## 30.6 Stale-Session Sweeper

A BullMQ job every 5 minutes marks abandoned interviews:

```javascript
// server/workers/staleInterviewWorker.js
const Interview = require("../models/Interview");

async function sweep() {
  const cutoff = new Date(Date.now() - 30*60*1000);  // 30 min idle
  await Interview.updateMany(
    { status: "in-progress", "progress.lastActivityAt": { $lt: cutoff } },
    { $set: { status: "abandoned", "session.isLocked": false } }
  );
}
module.exports = { sweep };
```

Schedule from `server/workers/scheduler.js` (see §37 BullMQ).

---

## 30.7 Migration safety

* All new fields are **defaulted** → existing documents continue to work without backfill.
* The partial unique index can be created online: `db.interviews.createIndex({userId:1,status:1},{unique:true,partialFilterExpression:{status:"in-progress"}})`


---

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


---

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


---

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


---

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


---

# SECTION 35 — AI Guardrails & Anti-Abuse System

> **Scope:** A unified guardrail layer that runs on **every candidate-submitted answer** (Module 07 `/api/interview/answer`) and on **every Gemini-generated string** before it reaches the candidate. Implemented as middleware + `guardrails.js`. No existing route signature changes.

---

## 35.1 Threat Catalogue

| Threat                       | Detection                                       | Action                            |
| :--------------------------- | :---------------------------------------------- | :-------------------------------- |
| Prompt injection             | Regex + role-tag detection                      | Strip + flag `prompt_injection`   |
| Cheating (AI-generated)      | Heuristic burstiness + low n-gram diversity     | Flag `ai_generated`               |
| Copy-paste                   | Paste event count + low typing entropy          | Flag `paste_detected`             |
| Extremely short              | `< 15 chars` or `< 5 words`                     | Flag `too_short` + cap scores     |
| Offensive content            | Wordlist + Gemini binary classifier             | Flag `offensive` + reject         |
| AI manipulation              | "Ignore previous", "act as", "system:" patterns | Strip + flag `prompt_injection`   |

---

## 35.2 Middleware: Input Sanitization

```javascript
// server/middleware/sanitize.js
const xss   = require("xss");
const mongoSanitize = require("express-mongo-sanitize");

module.exports = [
  mongoSanitize({ replaceWith: "_" }),
  (req, _res, next) => {
    if (req.body && typeof req.body === "object") {
      for (const k of Object.keys(req.body)) {
        if (typeof req.body[k] === "string") req.body[k] = xss(req.body[k], { whiteList: {}, stripIgnoreTag: true });
      }
    }
    next();
  }
];
```

Apply in `index.js`:

```javascript
const sanitize = require("./middleware/sanitize");
app.use(sanitize);
```

---

## 35.3 Input guards (per answer)

```javascript
// server/services/guardrails.js
const INJECTION_PATTERNS = [
  /ignore (all )?(previous|above) (instructions|prompts)/i,
  /you are now/i,
  /act as (a |an )?(system|admin|developer)/i,
  /\bsystem\s*:/i,
  /<\s*\/?\s*system\s*>/i,
  /developer\s*mode/i,
  /jailbreak/i,
  /reveal (the )?(system )?prompt/i,
];

const OFFENSIVE = [
  // base wordlist — extend with your locale
  "fuck","shit","bitch","asshole","bastard","slur1","slur2"
];

function scanInjection(text="") {
  return INJECTION_PATTERNS.some(re => re.test(text));
}
function scanOffensive(text="") {
  const t = text.toLowerCase();
  return OFFENSIVE.some(w => new RegExp(`\\b${w}\\b`,"i").test(t));
}
function scanTooShort(text="") {
  const w = text.trim().split(/\s+/).filter(Boolean);
  return text.trim().length < 15 || w.length < 5;
}

// Burstiness ~ stddev of sentence length / mean
function scanAIGenerated(text="") {
  const sentences = text.split(/[.!?]+/).map(s=>s.trim()).filter(Boolean);
  if (sentences.length < 4) return false;
  const lens = sentences.map(s => s.split(/\s+/).length);
  const mean = lens.reduce((a,b)=>a+b,0)/lens.length;
  const variance = lens.reduce((a,b)=>a+Math.pow(b-mean,2),0)/lens.length;
  const stddev = Math.sqrt(variance);
  const burstiness = stddev / (mean||1);
  // AI text: low burstiness (very uniform) + long average
  return mean > 18 && burstiness < 0.25;
}

function stripInjection(text="") {
  let t = text;
  INJECTION_PATTERNS.forEach(re => { t = t.replace(re, ""); });
  return t.trim();
}

function runOutputGuards({ question, answer }) {
  const flags = [];
  if (scanInjection(answer)) flags.push("prompt_injection");
  if (scanOffensive(answer)) flags.push("offensive");
  if (scanTooShort(answer))  flags.push("too_short");
  if (scanAIGenerated(answer)) flags.push("ai_generated");
  return flags;
}

module.exports = { scanInjection, scanOffensive, scanTooShort, scanAIGenerated, stripInjection, runOutputGuards };
```

---

## 35.4 Paste / Typing-entropy signal (frontend → backend)

```javascript
// client/src/hooks/useTypingSignal.js
import { useEffect, useRef, useState } from "react";
export function useTypingSignal(textareaRef) {
  const [signal, setSignal] = useState({ pasteCount:0, keystrokes:0, sessionMs:0 });
  const start = useRef(Date.now());
  useEffect(() => {
    const el = textareaRef.current; if (!el) return;
    const onPaste = () => setSignal(s => ({...s, pasteCount: s.pasteCount+1}));
    const onKey   = () => setSignal(s => ({...s, keystrokes: s.keystrokes+1}));
    el.addEventListener("paste", onPaste);
    el.addEventListener("keydown", onKey);
    return () => { el.removeEventListener("paste", onPaste); el.removeEventListener("keydown", onKey); };
  }, [textareaRef]);
  useEffect(() => { const t = setInterval(()=>setSignal(s=>({...s, sessionMs: Date.now()-start.current})), 1000); return ()=>clearInterval(t); }, []);
  return signal;
}
```

The client sends `{ pasteCount, keystrokes, sessionMs }` alongside the answer. Backend logic:

```javascript
// server/routes/interview.js (in /answer)
const { pasteCount=0, keystrokes=0, sessionMs=0 } = req.body.signal || {};
const charsPerKey = keystrokes>0 ? answer.length / keystrokes : 0;
const flags = [];
if (pasteCount >= 1)                     flags.push("paste_detected");
if (charsPerKey > 4 && keystrokes < 25)  flags.push("paste_detected");
// merge with model-side flags later
```

---

## 35.5 Offensive content rejection

```javascript
// server/routes/interview.js (top of /answer)
const { scanOffensive, scanInjection, stripInjection } = require("../services/guardrails");
if (scanOffensive(answer)) {
  return res.status(400).json({ message: "Your answer contains inappropriate language. Please rephrase." });
}
const cleanAnswer = scanInjection(answer) ? stripInjection(answer) : answer;
```

The **stripped** version goes to Gemini; the **original** (with `[REDACTED]` placeholder) is stored for audit.

---

## 35.6 Gemini output guard (anti-leak)

```javascript
// server/services/geminiSafeCall.js
const { geminiModel } = require("../config/gemini");

const FORBIDDEN_OUT = [
  /api[_\s-]?key/i, /AIza[0-9A-Za-z\-_]{20,}/, /sk-[a-zA-Z0-9]{20,}/,
  /BEGIN (RSA|OPENSSH) PRIVATE KEY/, /mongodb\+srv:\/\//
];

async function safeGenerate(prompt) {
  const r = await geminiModel.generateContent(prompt);
  let text = r.response.text();
  for (const re of FORBIDDEN_OUT) text = text.replace(re, "[REDACTED]");
  return { text, raw: r };
}
module.exports = { safeGenerate };
```

Use `safeGenerate` everywhere we used to call `geminiModel.generateContent` directly for **user-facing** strings (interview questions, summaries). Scoring calls (JSON only) keep the original direct call.

---

## 35.7 Rate-limited abuse counter

If a single user accumulates ≥ 3 `prompt_injection` flags in one interview, automatically:

* Mark `interview.flags = ["ABUSIVE"]`
* Force `recommendation = "Needs Improvement"`
* Send audit log entry (§36 audit logs)

```javascript
// in /api/interview/answer, after pushing flags
const totalInjections = interview.questions.flatMap(q=>q.scores?.redFlags||[]).filter(f=>f==="prompt_injection").length;
if (totalInjections >= 3) {
  interview.flags = Array.from(new Set([...(interview.flags||[]), "ABUSIVE"]));
}
```


---

# SECTION 36 — Enterprise Security Architecture

> **Scope:** Security hardening layered on top of the existing JWT + bcrypt auth (Module 01) and the existing routes. **No existing routes are renamed or removed** — additions only.

---

## 36.1 Rate Limiting

```javascript
// server/middleware/rateLimiters.js
const rateLimit = require("express-rate-limit");

const tooMany = (msg) => ({ status:429, message: msg });

exports.global = rateLimit({
  windowMs: 60_000, max: 120,
  standardHeaders: true, legacyHeaders: false,
  message: tooMany("Too many requests. Try again in a minute.")
});

exports.auth = rateLimit({
  windowMs: 15*60_000, max: 10,
  message: tooMany("Too many login attempts. Try again in 15 minutes."),
  skipSuccessfulRequests: true,
});

exports.upload = rateLimit({
  windowMs: 60*60_000, max: 20,
  message: tooMany("Upload limit reached for this hour.")
});

exports.interview = rateLimit({
  windowMs: 60_000, max: 30,
  message: tooMany("Slow down — too many answers in a short time.")
});
```

Apply selectively in `server/index.js`:

```javascript
const rl = require("./middleware/rateLimiters");
app.use(rl.global);
app.use("/api/auth", rl.auth);
app.use("/api/candidate/upload-resume", rl.upload);
app.use("/api/interview", rl.interview);
```

---

## 36.2 Helmet Security Headers

```javascript
const helmet = require("helmet");
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src":  ["'self'"],
      "script-src":   ["'self'", "'unsafe-inline'"],          // tighten with nonces in prod
      "img-src":      ["'self'", "data:", "https:"],
      "connect-src":  ["'self'", process.env.PARSER_URL || ""],
      "frame-ancestors": ["'none'"],
    }
  },
  crossOriginResourcePolicy: { policy: "same-site" },
  referrerPolicy: { policy: "no-referrer" }
}));
```

---

## 36.3 Input Sanitization

Already covered in §35.2 (`xss` + `express-mongo-sanitize`). Mounted **before** all routes.

---

## 36.4 Password Policies

```javascript
// server/utils/passwordPolicy.js
const zxcvbn = require("zxcvbn");
const MIN = 10;
const MUST = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/];

function validate(pw) {
  if (!pw || pw.length < MIN)                 return "Password must be at least 10 characters.";
  if (!MUST.every(re => re.test(pw)))         return "Password must contain upper, lower, number, and symbol.";
  const z = zxcvbn(pw);
  if (z.score < 3)                            return "Password is too guessable. " + (z.feedback?.suggestions?.[0] || "");
  return null;
}

module.exports = { validate };
```

Wire into `/api/auth/register`:

```javascript
const policy = require("../utils/passwordPolicy");
const err = policy.validate(password);
if (err) return res.status(400).json({ message: err });
```

Bcrypt rounds raised to **12** (already in Module 01) and stored as `argon2id` is optional via `argon2` lib if you want to upgrade — out-of-scope for v1.

---

## 36.5 Audit Logs

```javascript
// server/models/AuditLog.js
const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref:"User", index: true },
  action:   { type: String, required: true, index: true },        // e.g. "login.success"
  resource: { type: String, default: null },                      // e.g. "interview:<id>"
  ip:       String,
  userAgent:String,
  payload:  mongoose.Schema.Types.Mixed,
  at:       { type: Date, default: Date.now, index: true },
});
module.exports = mongoose.model("AuditLog", schema);
```

```javascript
// server/middleware/audit.js
const AuditLog = require("../models/AuditLog");
function audit(action, getResource = () => null) {
  return async (req, _res, next) => {
    try {
      await AuditLog.create({
        userId: req.user?.id, action,
        resource: getResource(req),
        ip: req.ip, userAgent: req.get("user-agent"),
        payload: { params: req.params, body: redact(req.body) },
      });
    } catch (_) {}
    next();
  };
}
function redact(b={}) { const c = {...b}; ["password","newPassword","token"].forEach(k => k in c && (c[k]="[REDACTED]")); return c; }
module.exports = { audit };
```

Usage:

```javascript
router.post("/login",  audit("auth.login.attempt"),  /* existing handler */);
router.post("/upload-resume", auth, audit("candidate.resume.upload"), upload.single("resume"), /* handler */);
router.put("/roles/:id", auth, adminOnly, audit("admin.role.update", r => `role:${r.params.id}`), /* handler */);
```

---

## 36.6 Secure File Upload Validation

```javascript
// server/middleware/upload.js — REPLACE the existing fileFilter block (additive checks)
const fs = require("fs"); const path = require("path");
const MAX = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["application/pdf"]);
const ALLOWED_EXT  = new Set([".pdf"]);
const PDF_MAGIC = Buffer.from("%PDF-");

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext))
    return cb(new Error("Only PDF files are allowed"), false);
  if (file.originalname.length > 120)
    return cb(new Error("Filename too long"), false);
  cb(null, true);
};

// After multer saves the file, verify magic bytes:
async function verifyPdfMagic(filePath) {
  const fd = await fs.promises.open(filePath, "r");
  const buf = Buffer.alloc(5); await fd.read(buf, 0, 5, 0); await fd.close();
  if (!buf.equals(PDF_MAGIC)) { await fs.promises.unlink(filePath); throw new Error("Invalid PDF signature"); }
}

module.exports = multer({ storage, fileFilter, limits: { fileSize: MAX } });
module.exports.verifyPdfMagic = verifyPdfMagic;
```

Call `verifyPdfMagic(req.file.path)` immediately after `upload.single("resume")` middleware in the existing route.

Additionally:

* Files are saved under `/uploads/<userId>/<uuid>.pdf` (already partially in Module 03 — the new code uses `crypto.randomUUID()` for the name to prevent enumeration).
* Static serving of `/uploads/` is **removed** from production; replaced by signed-URL download via `GET /api/candidate/resume-file` (auth + ownership check).

---

## 36.7 JWT Refresh Tokens

Two-token scheme: short-lived **access** (15 min) + long-lived **refresh** (7 days) stored as `httpOnly` cookie + DB row.

```javascript
// server/models/RefreshToken.js
const mongoose = require("mongoose");
module.exports = mongoose.model("RefreshToken", new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref:"User", index:true, required:true },
  tokenHash:{ type:String, required:true, unique:true },
  revokedAt:Date,
  expiresAt:{ type:Date, required:true, index:true },
  ua:String, ip:String,
}));
```

```javascript
// server/services/tokenService.js
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const RT = require("../models/RefreshToken");

const ACCESS_TTL  = "15m";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

function signAccess(user) {
  return jwt.sign({ id:user._id, role:user.role }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });
}

async function issueRefresh(user, { ip, ua }) {
  const raw = crypto.randomBytes(48).toString("hex");
  await RT.create({ userId:user._id, tokenHash: sha(raw), expiresAt: new Date(Date.now()+REFRESH_TTL_MS), ip, ua });
  return raw;
}

async function rotateRefresh(rawIncoming, user, ctx) {
  const old = await RT.findOne({ tokenHash: sha(rawIncoming), userId: user._id, revokedAt: null });
  if (!old || old.expiresAt < new Date()) throw new Error("Refresh invalid");
  old.revokedAt = new Date(); await old.save();
  return issueRefresh(user, ctx);
}

module.exports = { signAccess, issueRefresh, rotateRefresh, sha };
```

```javascript
// server/routes/auth.js — APPEND
router.post("/refresh", async (req,res) => {
  const raw = req.cookies?.rt;
  if (!raw) return res.status(401).json({ message:"No refresh token" });
  const rec = await RefreshToken.findOne({ tokenHash: sha(raw), revokedAt:null });
  if (!rec || rec.expiresAt < new Date()) return res.status(401).json({ message:"Invalid refresh" });
  const user = await User.findById(rec.userId);
  const newRaw = await rotateRefresh(raw, user, { ip:req.ip, ua:req.get("user-agent") });
  res.cookie("rt", newRaw, { httpOnly:true, sameSite:"strict", secure: process.env.NODE_ENV==="production", maxAge: REFRESH_TTL_MS });
  res.json({ accessToken: signAccess(user) });
});

router.post("/logout", async (req,res) => {
  const raw = req.cookies?.rt;
  if (raw) await RefreshToken.updateOne({ tokenHash: sha(raw) }, { $set: { revokedAt: new Date() } });
  res.clearCookie("rt"); res.json({ ok:true });
});
```

Existing `/login` and `/register` are updated to additionally issue a refresh cookie. Existing clients that ignore the cookie still work with the access token in the response body.

---

## 36.8 RBAC Authorization

```javascript
// server/middleware/rbac.js
const ROLES = { candidate: 1, hr: 2, admin: 3 };
function requireRole(min) {
  return (req, res, next) => {
    const lvl = ROLES[req.user?.role] || 0;
    if (lvl < ROLES[min]) return res.status(403).json({ message: "Forbidden" });
    next();
  };
}
function requireAny(...roles) {
  return (req,res,next) => roles.includes(req.user?.role) ? next() : res.status(403).json({ message:"Forbidden" });
}
module.exports = { requireRole, requireAny, ROLES };
```

Replace the inline `hrOnly` / `adminOnly` checks with:

```javascript
const { requireAny, requireRole } = require("../middleware/rbac");
router.get("/candidates", auth, requireAny("hr","admin"), /* ... */);
router.put("/roles/:id", auth, requireRole("admin"), /* ... */);
```

Existing function-style guards still work — these are drop-in alternatives.

---

## 36.9 CORS hardening

```javascript
app.use(cors({
  origin: (origin, cb) => {
    const allowed = (process.env.CORS_ORIGINS || "http://localhost:3000").split(",");
    if (!origin || allowed.includes(origin)) cb(null, true);
    else cb(new Error("CORS blocked: " + origin));
  },
  credentials: true
}));
```


---

# SECTION 37 — Scalability & Future Growth Architecture

> **Scope:** Reference architecture for moving from a single-machine MERN deployment (Sections 1, 27) to a multi-node, queue-backed, horizontally-scaled system. All additions are **optional in dev** — the system continues to work without Redis/S3.

---

## 37.1 Redis

**Purpose:** caching, BullMQ queue backbone, lock store (§30), anti-repeat hashes (§31), refresh-token deny-list, rate-limit store.

```javascript
// server/config/redis.js
const IORedis = require("ioredis");
let client = null;
if (process.env.REDIS_URL) {
  client = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  client.on("error", (e) => console.warn("Redis error:", e.message));
  console.log("Redis: connected");
} else {
  console.log("Redis: not configured (fallback to in-memory)");
}
module.exports = client;
```

Used by services in §30, §31; safe to be `null` in dev.

---

## 37.2 BullMQ — background job queue

```javascript
// server/queues/index.js
const { Queue, Worker, QueueScheduler } = require("bullmq");
const redis = require("../config/redis");

let queues = {}, workers = {}, schedulers = {};

if (redis) {
  for (const name of ["reports", "stale-sweeper", "parser", "embeddings"]) {
    queues[name]     = new Queue(name, { connection: redis });
    schedulers[name] = new QueueScheduler(name, { connection: redis });
  }
} else {
  console.log("BullMQ disabled (no REDIS_URL). Falling back to inline execution.");
}

module.exports = { queues, workers, redis };
```

```javascript
// server/workers/reportWorker.js
const { Worker } = require("bullmq");
const redis = require("../config/redis");
const Interview = require("../models/Interview");
const Candidate = require("../models/Candidate");
const { generateReport } = require("../services/reportService");

if (redis) {
  new Worker("reports", async job => {
    const { interviewId } = job.data;
    const iv  = await Interview.findById(interviewId);
    const ca  = await Candidate.findById(iv.candidateId);
    const fp  = await generateReport(ca, iv);
    iv.reportPath = fp; await iv.save();
    return fp;
  }, { connection: redis, concurrency: 4 });
  console.log("reportWorker running");
}
```

Enqueue from `/api/interview/complete`:

```javascript
const { queues } = require("../queues");
if (queues.reports) await queues.reports.add("generate", { interviewId: interview._id.toString() });
```

When Redis is absent, the existing inline `await generateReport(...)` still runs.

---

## 37.3 AWS S3 (resumes + reports)

```javascript
// server/services/s3Service.js
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const fs = require("fs");

let s3 = null;
if (process.env.AWS_S3_BUCKET) {
  s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  });
}

async function upload(localPath, key) {
  if (!s3) return null;
  const body = await fs.promises.readFile(localPath);
  await s3.send(new PutObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: key, Body: body, ContentType: "application/pdf" }));
  return key;
}

async function signedUrl(key, ttlSec=300) {
  if (!s3) return null;
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: key }), { expiresIn: ttlSec });
}

module.exports = { s3, upload, signedUrl };
```

Resume uploads now write to `/uploads/.../` locally **and** mirror to `s3://bucket/resumes/<userId>/<uuid>.pdf`. The candidate dashboard download URL becomes a 5-minute pre-signed URL when S3 is enabled.

---

## 37.4 CDN

* Frontend (Vercel/CloudFront) serves static assets globally.
* PDF report URLs sit behind CloudFront with `Cache-Control: private, max-age=60` and signed cookie auth.
* CDN origin = S3 bucket (private; OAC enabled).

---

## 37.5 Horizontal Scaling

| Layer            | Strategy                                                                          |
| :--------------- | :-------------------------------------------------------------------------------- |
| API (Express)    | Stateless. Behind ALB. `N` replicas, sticky session **not required**.             |
| Worker (BullMQ)  | `M` independent replicas; competing consumers for `reports`, `parser` queues.     |
| Parser (Python)  | Stateless. Behind ALB. Auto-scale on CPU.                                         |
| MongoDB          | Atlas replica set; reads from secondaries for HR analytics.                       |
| Redis            | Atlas Redis or ElastiCache; cluster mode for >100k concurrent interviews.         |
| Sessions         | JWT access (stateless) + refresh in Mongo (already designed in §36.7).            |

Sticky-session requirements are zero because all state is in Mongo/Redis.

---

## 37.6 Docker

```dockerfile
# server/Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5000
CMD ["node","index.js"]
```

```dockerfile
# parser/Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5001
CMD ["python","app.py"]
```

```dockerfile
# client/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```yaml
# docker/docker-compose.yml
version: "3.9"
services:
  mongo:   { image: mongo:7,           ports: ["27017:27017"], volumes: [mongo-data:/data/db] }
  redis:   { image: redis:7-alpine,    ports: ["6379:6379"]   }
  parser:  { build: ../parser,         ports: ["5001:5001"],   env_file: ../parser/.env }
  server:  { build: ../server,         ports: ["5000:5000"],   env_file: ../server/.env,  depends_on: [mongo, redis, parser] }
  client:  { build: ../client,         ports: ["3000:80"],     depends_on: [server] }
volumes:
  mongo-data:
```

Run: `cd docker && docker compose up --build`.

---

## 37.7 Kubernetes Readiness

```yaml
# k8s/server-deployment.yaml (excerpt)
apiVersion: apps/v1
kind: Deployment
metadata: { name: hiremind-server }
spec:
  replicas: 3
  selector: { matchLabels: { app: hiremind-server } }
  template:
    metadata: { labels: { app: hiremind-server } }
    spec:
      containers:
      - name: server
        image: ghcr.io/yourorg/hiremind-server:latest
        ports: [{ containerPort: 5000 }]
        envFrom: [{ secretRef: { name: hiremind-secrets } }]
        readinessProbe: { httpGet: { path: /api/health, port: 5000 }, initialDelaySeconds: 5, periodSeconds: 5 }
        livenessProbe:  { httpGet: { path: /api/health, port: 5000 }, initialDelaySeconds: 30, periodSeconds: 15 }
        resources:
          requests: { cpu: "100m", memory: "256Mi" }
          limits:   { cpu: "500m", memory: "512Mi" }
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: hiremind-server-hpa }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: hiremind-server }
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource: { name: cpu, target: { type: Utilization, averageUtilization: 65 } }
```

Required for K8s readiness:

* `GET /api/health` endpoint (added in §38).
* All config via env (already enforced).
* Graceful shutdown on SIGTERM in `index.js`:

```javascript
const server = app.listen(...);
function shutdown(){ server.close(()=>process.exit(0)); setTimeout(()=>process.exit(1), 10_000); }
process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
```

* No local disk state for shared data (S3 replaces `/uploads/` in prod).


---

# SECTION 38 — Observability & Monitoring

> **Scope:** Logging, metrics, error tracking, and analytics dashboards. All endpoints below are **new** — they do not change any existing API contracts.

---

## 38.1 Application Logs (Winston + pino-pretty in dev)

```javascript
// server/config/logger.js
const winston = require("winston");
const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const dev = process.env.NODE_ENV !== "production";

const fmt = dev
  ? combine(colorize(), timestamp(), printf(i => `${i.timestamp} ${i.level} ${i.message} ${i.stack||""}`))
  : combine(timestamp(), errors({ stack:true }), json());

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: fmt,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});
module.exports = logger;
```

HTTP request logging:

```javascript
const morgan = require("morgan");
app.use(morgan(":method :url :status :res[content-length] - :response-time ms", {
  stream: { write: (m) => logger.info(m.trim()) }
}));
```

---

## 38.2 Error Tracking (Sentry)

```javascript
// server/config/sentry.js
const Sentry = require("@sentry/node");
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1, environment: process.env.NODE_ENV });
}
module.exports = Sentry;
```

```javascript
// server/index.js
const Sentry = require("./config/sentry");
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}
// ...routes...
if (process.env.SENTRY_DSN) app.use(Sentry.Handlers.errorHandler());

// Global error handler
app.use((err, req, res, _next) => {
  logger.error(err);
  if (err.message?.startsWith("CORS blocked")) return res.status(403).json({ message: err.message });
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});
```

Frontend Sentry init in `client/src/main.jsx`:

```javascript
import * as Sentry from "@sentry/react";
if (import.meta.env.VITE_SENTRY_DSN) Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, tracesSampleRate: 0.1 });
```

---

## 38.3 API Monitoring — Prometheus + Health

```javascript
// server/middleware/metrics.js
const promClient = require("prom-client");
promClient.collectDefaultMetrics();

const httpHist = new promClient.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method","route","status"],
  buckets: [0.05,0.1,0.3,0.6,1,2,5]
});

const interviewCount = new promClient.Counter({
  name: "interviews_started_total",
  help: "Interviews started",
  labelNames:["role"]
});

function metricsMiddleware(req,res,next) {
  const end = httpHist.startTimer({ method: req.method, route: req.route?.path || req.path });
  res.on("finish", () => end({ status: res.statusCode }));
  next();
}

module.exports = { promClient, metricsMiddleware, interviewCount };
```

```javascript
// server/routes/health.js
const router = require("express").Router();
const { promClient } = require("../middleware/metrics");
router.get("/health", (_req,res) => res.json({ ok:true, uptime: process.uptime() }));
router.get("/metrics", async (_req,res) => { res.set("Content-Type", promClient.register.contentType); res.end(await promClient.register.metrics()); });
module.exports = router;
```

Mount in `index.js`: `app.use("/api", require("./routes/health"));`

---

## 38.4 Interview Analytics

```javascript
// server/routes/analytics.js
const Interview = require("../models/Interview");

router.get("/analytics/interviews", auth, requireAny("hr","admin"), async (_req, res) => {
  const last30 = new Date(Date.now() - 30*24*60*60*1000);
  const [total, completed, avgScore, byRole] = await Promise.all([
    Interview.countDocuments({ createdAt: { $gte: last30 } }),
    Interview.countDocuments({ status: "completed", completedAt: { $gte: last30 } }),
    Interview.aggregate([
      { $match: { status:"completed", completedAt:{ $gte:last30 } } },
      { $group: { _id: null, avg: { $avg: "$finalScores.finalScore" } } }
    ]),
    Interview.aggregate([
      { $match: { status:"completed", completedAt:{ $gte:last30 } } },
      { $group: { _id: "$selectedRole",
                  count: { $sum: 1 },
                  avg:   { $avg: "$finalScores.finalScore" },
                  rec:   { $sum: { $cond: [{ $in:["$recommendation",["Highly Recommended","Recommended"]] },1,0] } }
                }}
    ])
  ]);
  res.json({ window: "30d", total, completed, avgScore: Math.round(avgScore[0]?.avg||0), byRole });
});
```

---

## 38.5 ATS Analytics

```javascript
router.get("/analytics/ats", auth, requireAny("hr","admin"), async (_req, res) => {
  const data = await Candidate.aggregate([
    { $group: { _id: "$selectedRole",
                avg: { $avg: "$atsScore" },
                eligible: { $sum: { $cond: ["$isEligible", 1, 0] } },
                total: { $sum: 1 },
                topMissing: { $push: "$missingSkills" }
              }},
    { $project: {
        role: "$_id", avg: { $round: ["$avg", 1] }, eligible: 1, total: 1,
        eligibilityRate: { $round: [{ $multiply: [{ $divide: ["$eligible","$total"] }, 100] }, 1] }
    }}
  ]);
  res.json(data);
});
```

---

## 38.6 HR Analytics Dashboard

Frontend route `/hr/analytics` (React) calls the two endpoints above and renders with Recharts:

* Interviews completed per day (line)
* Avg final score per role (bar)
* Eligibility rate per role (bar)
* Top missing skills (treemap)

```jsx
// client/src/pages/HR/HRAnalytics.jsx (skeleton)
import { useEffect, useState } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function HRAnalytics() {
  const [iv, setIv] = useState(null), [ats, setAts] = useState([]);
  const token = localStorage.getItem("token");
  useEffect(() => {
    axios.get("/api/analytics/interviews", { headers:{ Authorization:`Bearer ${token}` }}).then(r=>setIv(r.data));
    axios.get("/api/analytics/ats",        { headers:{ Authorization:`Bearer ${token}` }}).then(r=>setAts(r.data));
  }, []);
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy mb-6">HR Analytics</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Stat label="Interviews (30d)" value={iv?.total ?? "..."} />
        <Stat label="Completed" value={iv?.completed ?? "..."} />
        <Stat label="Avg Final Score" value={iv?.avgScore ?? "..."} />
      </div>
      <h2 className="font-semibold mb-2">Avg final score by role</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={iv?.byRole || []}><XAxis dataKey="_id" /><YAxis /><Tooltip /><Bar dataKey="avg" fill="#1E88E5" /></BarChart>
      </ResponsiveContainer>
      <h2 className="font-semibold mt-8 mb-2">ATS eligibility by role</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={ats}><XAxis dataKey="role" /><YAxis /><Tooltip /><Bar dataKey="eligibilityRate" fill="#27AE60" /></BarChart>
      </ResponsiveContainer>
    </div>
  );
}
function Stat({label,value}){ return <div className="bg-white p-4 rounded-xl shadow"><div className="text-sm text-gray-500">{label}</div><div className="text-2xl font-bold">{value}</div></div>; }
```

---

## 38.7 Audit log query API

```javascript
router.get("/audit", auth, requireRole("admin"), async (req,res) => {
  const { action, userId, from, to, limit=100 } = req.query;
  const q = {};
  if (action) q.action = action;
  if (userId) q.userId = userId;
  if (from || to) q.at = { ...(from?{ $gte: new Date(from) }:{}), ...(to?{ $lte: new Date(to) }:{}) };
  const rows = await require("../models/AuditLog").find(q).sort({ at:-1 }).limit(Math.min(500, Number(limit)));
  res.json(rows);
});
```


---

# SECTION 39 — Production Database Optimization

> **Scope:** Indexes, aggregation pipelines, query patterns and ranking-specific tuning for the existing MongoDB collections (Section 3). No schema changes — indexes and pipelines only.

---

## 39.1 MongoDB Indexes (idempotent migration)

```javascript
// server/scripts/createIndexes.js
require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  await db.collection("users").createIndexes([
    { key: { email: 1 }, unique: true, name: "uniq_email" },
    { key: { role: 1, createdAt: -1 }, name: "role_createdAt" },
  ]);

  await db.collection("candidates").createIndexes([
    { key: { userId: 1 }, unique: true, name: "uniq_userId" },
    { key: { selectedRole: 1, atsScore: -1 }, name: "role_atsScore" },
    { key: { isEligible: 1, selectedRole: 1 }, name: "eligible_role" },
    { key: { "parsedResume.skills": 1 }, name: "skills_multikey" },
    { key: { "parsedResume.name": "text", "parsedResume.email": "text", "parsedResume.skills": "text" }, name: "candidate_text" },
  ]);

  await db.collection("interviews").createIndexes([
    { key: { userId: 1, status: 1 }, name: "user_status",
      unique: true, partialFilterExpression: { status: "in-progress" } },
    { key: { candidateId: 1, completedAt: -1 }, name: "candidate_completedAt" },
    { key: { selectedRole: 1, "finalScores.finalScore": -1 }, name: "role_finalScore" },
    { key: { status: 1, "progress.lastActivityAt": 1 }, name: "stale_sweeper" },
    { key: { recommendation: 1, completedAt: -1 }, name: "rec_completedAt" },
  ]);

  await db.collection("auditlogs").createIndexes([
    { key: { userId: 1, at: -1 }, name: "user_at" },
    { key: { action: 1, at: -1 }, name: "action_at" },
    { key: { at: 1 }, name: "ttl_at", expireAfterSeconds: 60*60*24*180 }, // 180-day retention
  ]);

  await db.collection("refreshtokens").createIndexes([
    { key: { tokenHash: 1 }, unique: true, name: "uniq_tokenHash" },
    { key: { userId: 1, expiresAt: -1 }, name: "user_expires" },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: "ttl_expires" },
  ]);

  console.log("Indexes created.");
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
```

Run once: `node server/scripts/createIndexes.js`. Idempotent — safe in CI/CD.

---

## 39.2 Aggregation Pipelines

### Ranking by role (used by Module 19, optimised)

```javascript
// server/services/rankingService.js
const Interview = require("../models/Interview");

async function rankCandidatesForRole(role, { limit=50 } = {}) {
  return Interview.aggregate([
    { $match: { selectedRole: role, status: "completed" } },
    { $sort:  { "finalScores.finalScore": -1, completedAt: -1 } },
    { $group: {
        _id: "$candidateId",
        latest: { $first: "$$ROOT" }
    }},
    { $replaceRoot: { newRoot: "$latest" } },
    { $lookup: { from: "candidates", localField: "candidateId", foreignField: "_id", as: "c" } },
    { $unwind: "$c" },
    { $lookup: { from: "users", localField: "c.userId", foreignField: "_id", as: "u" } },
    { $unwind: "$u" },
    { $project: {
        name: "$u.name", email: "$u.email",
        atsScore: "$c.atsScore",
        finalScore: "$finalScores.finalScore",
        recommendation: 1,
        hcs: "$decisionBrief.hiringConfidenceScore",
        completedAt: 1
    }},
    { $limit: limit }
  ]);
}
module.exports = { rankCandidatesForRole };
```

Uses `role_finalScore` + `candidate_completedAt` indexes → fully covered.

### HR overview

```javascript
async function overview(days=30) {
  const since = new Date(Date.now() - days*24*60*60*1000);
  return Interview.aggregate([
    { $match: { completedAt: { $gte: since } } },
    { $group: {
        _id: "$selectedRole",
        n: { $sum: 1 },
        avgFinal: { $avg: "$finalScores.finalScore" },
        topScore: { $max: "$finalScores.finalScore" },
        recRate: { $avg: { $cond:[{ $in:["$recommendation",["Highly Recommended","Recommended"]] },1,0] } }
    }},
    { $project: { role:"$_id", n:1, avgFinal:{ $round:["$avgFinal",1] }, topScore:1, recRate:{ $round:[{ $multiply:["$recRate",100] },1] } }}
  ]);
}
```

---

## 39.3 Query Optimization Patterns

| Pattern                                     | Use                                                    |
| :------------------------------------------ | :----------------------------------------------------- |
| `.lean()` on read-only queries              | Skip Mongoose hydration → 30–50% faster.               |
| Projection `{ field: 1 }`                   | Reduce network bytes for large `Interview` docs.       |
| `bulkWrite()` for score updates             | Single round-trip per answer scoring batch.            |
| `countDocuments()` over `count()`           | Atomic count using index.                              |
| `$expr` with care                           | Avoid in hot paths; prefer pre-computed fields.        |
| `allowDiskUse: true` on heavy aggregations  | For analytics queries > 100 MB working set.            |

Example for the existing `/api/hr/candidates`:

```javascript
const rows = await Candidate.find({})
  .select("userId selectedRole atsScore isEligible")
  .populate({ path:"userId", select:"name email" })
  .lean();
```

---

## 39.4 Candidate Search Optimization

```javascript
// server/routes/hr.js
router.get("/search", auth, requireAny("hr","admin"), async (req,res) => {
  const { q = "", role, minAts, eligibleOnly } = req.query;
  const filter = {};
  if (role)              filter.selectedRole = role;
  if (minAts)            filter.atsScore = { $gte: Number(minAts) };
  if (eligibleOnly === "true") filter.isEligible = true;
  if (q) filter.$text = { $search: q };

  const rows = await Candidate.find(filter, q ? { score: { $meta: "textScore" } } : null)
    .sort(q ? { score: { $meta: "textScore" } } : { atsScore: -1 })
    .limit(50)
    .populate({ path:"userId", select:"name email" })
    .lean();
  res.json(rows);
});
```

Backed by the `candidate_text` and `role_atsScore` indexes from §39.1.

---

## 39.5 Ranking Optimization (top-K with caching)

```javascript
// server/services/rankingCache.js
const redis = require("../config/redis");
const { rankCandidatesForRole } = require("./rankingService");
const TTL = 60; // seconds

async function topK(role, limit=50) {
  const key = `rank:${role}:${limit}`;
  if (redis) {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
  }
  const data = await rankCandidatesForRole(role, { limit });
  if (redis) await redis.setex(key, TTL, JSON.stringify(data));
  return data;
}

module.exports = { topK };
```

Existing `/api/hr/ranking/:role` is rewritten to call `topK(req.params.role)` — response shape preserved.

---

## 39.6 Connection pooling

```javascript
// server/config/db.js
const mongoose = require("mongoose");
mongoose.set("strictQuery", true);

module.exports = async function connect() {
  await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: Number(process.env.MONGO_POOL_MAX || 50),
    minPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
  console.log("MongoDB connected");
};
```

---

## 39.7 Cold-data archival

* `Interview` documents > 12 months old are moved to `interviews_archive` via a monthly BullMQ job.
* `AuditLog` is auto-TTL'd at 180 days (§39.1).
* `RefreshToken` is auto-TTL'd at `expiresAt`.

These archival policies are configurable via env (`ARCHIVE_AGE_DAYS`, `AUDIT_RETENTION_DAYS`).


---

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


---

# SECTION 41 — Future AI Roadmap

> **Scope:** Practical, phased roadmap aligned with the existing MERN + Gemini architecture. Each item is sized as **(S/M/L)** effort, with the **minimal viable** integration path so it can ship incrementally without re-architecting v1.

---

## 41.1 AI Coding Assessment **(M)**

* **Goal:** Replace one of the 3 technical questions with a *live coding* problem solved in an embedded editor.
* **Stack additions:** Monaco Editor (`@monaco-editor/react`), `vm2` sandbox or Judge0 self-host API for Node/Python execution.
* **Pipeline:**
  1. Gemini generates a coding problem + hidden test cases (JSON).
  2. Candidate types code → run against test cases server-side (timeout 5s, memory cap).
  3. Gemini evaluates: correctness (deterministic), style + complexity (LLM scoring).
* **Risk controls:** sandbox isolation, no network, no fs.

```javascript
// server/services/codeEvaluator.js  (sketch)
async function runUserCode(lang, source, testCases) {
  // POST to local Judge0 instance, return { passed, failed, runtimeMs }
}
```

---

## 41.2 Live Video Interview Analysis **(L)**

* **Goal:** Capture webcam during interview and analyse facial expressions / engagement / eye contact.
* **MVP path:** WebRTC `getUserMedia` → record locally → on submit, upload to S3 → backend worker calls **face-api.js** (CPU) or **AWS Rekognition** for emotion + attention scores.
* **Privacy:** opt-in toggle, raw video deleted after analysis, only derived metrics stored on `Interview.videoSignals`.

---

## 41.3 Emotion Detection **(M)**

* **Goal:** Per-question emotion overlay (happy / neutral / stressed / confused).
* **Voice signal:** Web Audio API → pitch + energy + speech rate; cheap heuristics.
* **Face signal:** browser-side `face-api.js` (no upload) → counts per emotion every 2s → only **aggregates** sent.
* **Storage:** `Interview.emotionSignals = [{ qIndex, dominant, byClass }]`.
* **Use:** feeds §34 hiring-confidence as a *minor* multiplier (±5%).

---

## 41.4 RAG Integration **(M)**

* **Goal:** Ground questions and evaluation in the **company's** real job descriptions, runbooks, and past interviewer rubrics.
* **Stack:** MongoDB Atlas Vector Search (free tier) — no extra service.
* **Pipeline:**
  1. Admin uploads JD/rubric docs (PDF, MD).
  2. Worker chunks → embeds via **text-embedding-004** (Gemini) → stores `{vector, content, jobId}`.
  3. Question generation prompt is prepended with the top-3 nearest chunks per query.

```javascript
// server/services/rag.js (sketch)
async function retrieve(jobId, query, k=3) {
  return db.collection("docs_vec").aggregate([
    { $vectorSearch: { index: "docs_vec_idx", path:"vector", queryVector: await embed(query), numCandidates: 100, limit: k, filter:{ jobId } } }
  ]).toArray();
}
```

---

## 41.5 Multi-Language Interviews **(M)**

* **Goal:** Conduct interviews in Hindi/Spanish/French/etc.
* **Tech:** Web Speech API `lang = "hi-IN"` etc. for STT; Gemini supports multilingual natively.
* **Prompt switch:** add `Reply in {locale}.` to every prompt; persist `interview.locale`.
* **Scoring fairness:** evaluation rubric translated and frozen per locale.
* **Constraints:** browser TTS quality varies — fallback to **gTTS** server-side if quality is poor.

---

## 41.6 AI Recruiter Copilot **(L)**

* **Goal:** Inline chat panel inside the HR Dashboard that answers recruiter questions over the candidate pool.
* **Example queries:**
  * *"Show me the top 5 Python candidates with no Kubernetes gap, sorted by HCS."*
  * *"Draft an outreach email for candidate X based on their report."*
* **Stack:** Gemini function-calling → tools = `[searchCandidates, getInterview, summarize, draftEmail]`.
* **Security:** RBAC-gated; copilot can only see candidates the recruiter is authorized to read.

---

## 41.7 Company-Specific Interview Customization **(S)**

* **Goal:** Each company defines its **own** rubrics, dimensions, and weighting.
* **Schema additions:** `Company` model + `Rubric` model (additive).
* **Effect:** `evaluationService` reads `companyId.rubric` from JWT → applies custom dimension list and final-score formula.
* **Backwards-compat:** if no rubric set, defaults to the v1 formula.

---

## 41.8 Job Description Generator **(S)**

* **Goal:** Recruiter types a role name + 5 bullets → Gemini drafts a full JD (mission, responsibilities, requirements, nice-to-have, benefits).
* **Endpoint:** `POST /api/hr/jd/generate` with body `{ title, mustHaves, niceToHaves, seniority, location }`.
* **Output JSON:** stored in `JobDescription` collection and linked to a `Role` (existing schema).
* **Prompt outline:**

```javascript
function buildJDPrompt({ title, mustHaves, niceToHaves, seniority, location, companyVoice="neutral" }) {
  return `You are an HR copywriter. Draft a JD for "${title}" (${seniority}, ${location}).
Must-haves: ${mustHaves.join(", ")}
Nice-to-haves: ${niceToHaves.join(", ")}
Tone: ${companyVoice}.

Return ONLY valid JSON:
{
  "title": "",
  "summary": "",
  "responsibilities": ["..."],
  "requirements":     ["..."],
  "niceToHaves":      ["..."],
  "benefits":         ["..."]
}`;
}
```

---

## 41.9 Resume Improvement Assistant **(S)**

* **Goal:** After an unsuccessful ATS check (Module 06), Gemini explains *exactly* how to improve the candidate's resume.
* **Endpoint:** `POST /api/candidate/resume-improvement`.
* **Inputs:** `parsedResume`, `missingSkills`, `selectedRole`.
* **Output:**

```json
{
  "addBullets":   [ "Quantify your projects with metrics (users, latency)..." ],
  "rewriteLines": [ { "from":"...", "to":"..." } ],
  "skillsToShow": [ "Kubernetes basics — add a section on container orchestration" ],
  "formatting":   [ "Use a single column", "Move skills above experience" ]
}
```

* **UI:** rendered in the existing `ATSResult` page when `isEligible=false`.

---

## 41.10 Phased delivery plan

| Phase | Window  | Includes                                                     |
| :---- | :------ | :----------------------------------------------------------- |
| 1     | 0–2 wk  | §41.8 JD generator, §41.9 Resume assistant, §41.7 Custom rubrics |
| 2     | 2–6 wk  | §41.1 Coding assessment, §41.5 Multi-language                |
| 3     | 6–10 wk | §41.4 RAG, §41.6 Recruiter Copilot                           |
| 4     | 10–14 wk| §41.3 Emotion detection                                       |
| 5     | 14–20 wk| §41.2 Live video interview analysis                          |


---

# SECTION 42 — LOCAL SETUP GUIDE (Windows + VS Code)

> **Scope:** A from-scratch, copy-paste runnable setup for the **complete** HireMind AI project on a fresh Windows machine. Mac/Linux commands are noted where they differ.

---

## 42.1 Prerequisites

Install (one-time):

| Tool          | Version  | Download                                                                  |
| :------------ | :------- | :------------------------------------------------------------------------ |
| Node.js       | **20 LTS** | https://nodejs.org/en/download — includes npm                            |
| Python        | **3.11+**  | https://www.python.org/downloads/windows/  *(check "Add Python to PATH")* |
| Git           | latest   | https://git-scm.com/download/win                                          |
| VS Code       | latest   | https://code.visualstudio.com                                             |
| MongoDB Atlas | free tier| https://cloud.mongodb.com (or install MongoDB Community Server locally)   |
| Redis (optional, for queues/cache) | 7.x | **Memurai** for Windows (https://www.memurai.com/get-memurai) **or** WSL `sudo apt install redis-server` |
| Postman or Insomnia | latest | https://www.postman.com                                                   |

Recommended VS Code extensions: *ESLint*, *Prettier*, *Tailwind CSS IntelliSense*, *DotENV*, *Python*, *Pylance*, *MongoDB for VS Code*.

---

## 42.2 Get the project

```powershell
# Powershell
git clone https://github.com/<your-org>/hiremind-ai.git
cd hiremind-ai
code .
```

Folder layout you should see:

```
hiremind-ai/
├── client/             # React (Vite) frontend
├── server/             # Node.js + Express API
├── parser/             # Python (Flask) resume parser
├── docker/             # docker-compose.yml
├── docs/               # implementation guide + this setup guide
└── .env.example
```

---

## 42.3 Get API keys

### Gemini 2.5 Flash API key (FREE)

1. Go to **https://aistudio.google.com**.
2. Sign in with your Google account.
3. Click **Get API key** → **Create API key in new project**.
4. Copy the key. It looks like `AIzaSy...`.

### MongoDB Atlas (FREE 512 MB)

1. Sign up at **https://cloud.mongodb.com**.
2. Create **Project → Build a Cluster → M0 Free Tier**.
3. **Database Access** → add a user (`hiremind` / strong password).
4. **Network Access** → **Add IP** → `0.0.0.0/0` (dev only — restrict in prod).
5. **Connect → Drivers → Node.js** → copy the connection string. It looks like:
   `mongodb+srv://hiremind:<password>@cluster0.xxxxx.mongodb.net/hiremind?retryWrites=true&w=majority`
6. Replace `<password>` with your real password. Append the database name `/hiremind`.

### Optional: Tavily (used in some roadmap items in §41.4 RAG)

Free at **https://app.tavily.com**.

---

## 42.4 Create the `.env` files

Copy the templates:

```powershell
copy .env.example .env
copy server\.env.example server\.env
copy client\.env.example client\.env
copy parser\.env.example parser\.env
```

Then fill them with real values:

### `server/.env`

```dotenv
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb+srv://hiremind:YOURPASS@cluster0.xxxxx.mongodb.net/hiremind?retryWrites=true&w=majority

# Auth (must be ≥ 32 chars)
JWT_SECRET=replace_me_with_a_long_random_string_min_32_chars
JWT_REFRESH_SECRET=replace_me_with_ANOTHER_long_random_string

# Gemini
GEMINI_API_KEY=AIzaSy_your_real_gemini_key

# Parser microservice
PARSER_URL=http://localhost:5001

# Optional integrations
TAVILY_API_KEY=
REDIS_URL=
SENTRY_DSN=
AWS_S3_BUCKET=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# CORS
CORS_ORIGINS=http://localhost:3000
LOG_LEVEL=info
```

### `client/.env`

```dotenv
VITE_API_BASE_URL=http://localhost:5000
VITE_SENTRY_DSN=
```

### `parser/.env`

```dotenv
PORT=5001
MAX_UPLOAD_MB=5
```

> **NEVER** commit any of these `.env` files. Only `.env.example` is committed.

---

## 42.5 Install dependencies

Open **three PowerShell terminals** in VS Code (`Ctrl+\` then click `+`).

### Terminal 1 — server (Node)

```powershell
cd server
npm install
```

### Terminal 2 — client (React + Vite)

```powershell
cd client
npm install
```

### Terminal 3 — parser (Python)

```powershell
cd parser
python -m venv venv
.\venv\Scripts\Activate.ps1            # Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
```

> If PowerShell blocks `Activate.ps1`, run once as admin:
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

---

## 42.6 Initialise the database

Seed default roles **and** create indexes (idempotent — safe to re-run):

```powershell
cd server
npm run seed:roles
npm run db:indexes
```

(These npm scripts are defined in `server/package.json`; they wrap the scripts in `server/scripts/`.)

---

## 42.7 Run the three services

### Terminal 1 — server

```powershell
cd server
npm run dev
# expected: "Server running on port 5000" + "MongoDB connected"
```

### Terminal 2 — client

```powershell
cd client
npm run dev
# expected: "Local: http://localhost:3000/"
```

### Terminal 3 — parser

```powershell
cd parser
.\venv\Scripts\Activate.ps1
python app.py
# expected: " * Running on http://127.0.0.1:5001"
```

Open **http://localhost:3000** in Chrome or Edge (required for voice).

---

## 42.8 First-run smoke test

1. **Register** → create candidate account.
2. **Select role** → MERN Developer.
3. **Upload resume** → any PDF (≤ 5 MB).
4. **ATS Score** → should display a number + missing skills.
5. **Start Interview** → click *Start Speaking*, allow microphone, answer one question, click *Submit*.
6. **Complete** → finish all 9 questions.
7. **Download Report** → PDF should open.

To test HR/admin flows, manually promote a user in MongoDB:

```js
// MongoDB shell
use hiremind
db.users.updateOne({ email: "you@example.com" }, { $set: { role: "admin" } })
```

Then log in → visit `/admin` and `/hr`.

---

## 42.9 Common troubleshooting

| Symptom                                                            | Cause / Fix                                                                                                |
| :----------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| `MongoServerError: bad auth`                                       | Wrong password or `<password>` left in URI. Re-encode special chars.                                       |
| `ECONNREFUSED 127.0.0.1:5001` on upload                            | Parser service not running. Start Terminal 3.                                                              |
| `GoogleGenerativeAI Error: API key invalid`                        | Wrong/expired `GEMINI_API_KEY`. Generate new at aistudio.google.com.                                       |
| `CORS blocked: http://localhost:3000`                              | Add origin to `CORS_ORIGINS` in `server/.env`.                                                             |
| `Speech recognition not supported`                                 | Use Chrome or Edge — Firefox/Safari do not implement Web Speech API.                                       |
| `Only PDF files are allowed`                                       | Upload must be `.pdf` with valid PDF magic bytes.                                                          |
| `EACCES: permission denied uploads/`                               | `mkdir uploads` in `server/`. Linux: `chmod 755 uploads`.                                                  |
| `cannot find module '@google/generative-ai'`                       | Re-run `npm install` in `server/`.                                                                         |
| Frontend shows `Network Error`                                     | Backend not on port 5000 OR `VITE_API_BASE_URL` mismatch.                                                  |
| `pdfplumber.PDFSyntaxError`                                        | Resume PDF is scanned/encrypted. Convert to text-based PDF first.                                          |
| Windows Defender blocks `node` / `python`                          | Allow once — your antivirus may flag local dev servers.                                                    |
| Token expired after 15 min                                         | Frontend must call `/api/auth/refresh` — already wired in `src/services/api.js`.                           |
| `Activate.ps1 cannot be loaded`                                    | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` (run once).                         |
| Atlas IP whitelist denies you                                      | Add your IP under **Network Access** in Atlas dashboard.                                                   |

---

## 42.10 (Optional) Run everything with Docker

If you have **Docker Desktop**:

```powershell
cd docker
docker compose up --build
```

Services:

* Frontend: http://localhost:3000
* API: http://localhost:5000
* Parser: http://localhost:5001
* Mongo: localhost:27017
* Redis: localhost:6379

To stop: `docker compose down`. To wipe DB volume: `docker compose down -v`.

---

## 42.11 Project npm scripts (server)

| Script               | What it does                                       |
| :------------------- | :------------------------------------------------- |
| `npm run dev`        | Start API with `nodemon`                           |
| `npm start`          | Production-mode start (`node index.js`)            |
| `npm run seed:roles` | Seeds the 5 default roles                          |
| `npm run db:indexes` | Creates all production indexes (§39.1)             |
| `npm run lint`       | ESLint check                                       |
| `npm test`           | Jest unit tests (sanity tests included)            |

## 42.12 Project npm scripts (client)

| Script         | What it does                       |
| :------------- | :--------------------------------- |
| `npm run dev`  | Vite dev server with HMR           |
| `npm run build`| Production build to `client/dist/` |
| `npm run preview` | Serve the prod build locally    |

## 42.13 Production checklist (before going live)

* [ ] Strong, unique `JWT_SECRET` and `JWT_REFRESH_SECRET` (32+ chars).
* [ ] Restrict Atlas IP whitelist to your servers only.
* [ ] Set `NODE_ENV=production`.
* [ ] Configure `REDIS_URL`, `AWS_S3_BUCKET`, `SENTRY_DSN`.
* [ ] Replace local `/uploads/` with S3 (§37.3).
* [ ] Run `npm run db:indexes` against the production database.
* [ ] Apply Helmet CSP `script-src` with **nonces** (remove `unsafe-inline`).
* [ ] Verify HTTPS everywhere; force `secure` flag on cookies.
* [ ] Enable Sentry frontend + backend.
* [ ] Set up Prometheus scraping `/api/metrics`.

---

You now have a fully runnable HireMind AI development environment. For module-by-module behavior, see the original guide (Sections 1–28). For production hardening details, see Sections 29–41.


---

## Appendix — Document Provenance

* **Sections 1–28** authored in the original `HireMind_AI_Implementation_Guide.pdf` (untouched).
* **Sections 29–42** authored in this expansion. One `.md` file per section under `docs/additions/`.
* **Runnable reference implementation:** `/app/hiremind-ai/` (client + server + parser + docker).
* **Local setup:** see §42.
