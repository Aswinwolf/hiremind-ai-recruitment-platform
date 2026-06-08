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
