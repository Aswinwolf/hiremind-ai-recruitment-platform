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
